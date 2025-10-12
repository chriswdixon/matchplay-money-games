import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-PAYOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");
    
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { amount } = await req.json();
    if (!amount || amount <= 0) {
      throw new Error("Invalid payout amount");
    }

    // Get player account
    const { data: account, error: accountError } = await supabaseClient
      .from('player_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (accountError || !account) {
      throw new Error("Account not found");
    }

    const balance = parseFloat(account.balance);
    if (balance < amount) {
      throw new Error("Insufficient balance for payout");
    }

    logStep("Processing payout", { amount, currentBalance: balance });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find customer
    const customers = await stripe.customers.list({ 
      email: user.email!, 
      limit: 1 
    });

    if (customers.data.length === 0) {
      throw new Error("No Stripe customer found. Please add a payment method first.");
    }

    const customerId = customers.data[0].id;

    // Create payout using Stripe's refund/transfer mechanism
    // Note: In production, you'd use Stripe Connect for actual payouts
    // For now, we'll create a negative payment intent (refund simulation)
    const paymentIntent = await stripe.refunds.create({
      amount: Math.round(amount * 100),
      reason: 'requested_by_customer',
      metadata: {
        user_id: user.id,
        type: 'account_payout'
      }
    });

    // Deduct from account
    const { error: updateError } = await supabaseClient
      .from('player_accounts')
      .update({ balance: balance - amount })
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    // Record transaction
    await supabaseClient
      .from('account_transactions')
      .insert({
        user_id: user.id,
        account_id: account.id,
        amount: -amount,
        transaction_type: 'payout',
        description: `Payout to payment method`,
        stripe_payment_intent_id: paymentIntent.id,
        metadata: { payout_method: 'stripe_refund' }
      });

    logStep("Payout processed successfully");
    return new Response(JSON.stringify({ 
      success: true, 
      newBalance: balance - amount,
      payoutId: paymentIntent.id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
