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
    
    logStep("User authenticated", { userId: user.id });

    const MAX_PAYOUT = 10000; // $10,000 maximum payout per transaction (in dollars)
    const { amount } = await req.json();
    
    if (!amount || amount <= 0 || amount > MAX_PAYOUT) {
      throw new Error(`Invalid payout amount. Must be between $0.01 and $${MAX_PAYOUT.toLocaleString()}`);
    }

    // Convert amount to cents for database operations (balance is stored in cents)
    const amountInCents = Math.round(amount * 100);

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
    if (balance < amountInCents) {
      throw new Error("Insufficient balance for payout");
    }

    logStep("Processing payout", { amount, amountInCents, currentBalance: balance });

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

    // SECURITY NOTICE: Payout functionality is disabled
    // This requires Stripe Connect implementation with proper:
    // - Identity verification (KYC)
    // - Banking information collection
    // - Regulatory compliance (1099 forms, etc.)
    // - Use of stripe.transfers.create() or stripe.payouts.create()
    // 
    // Current implementation using refunds is non-functional and insecure
    throw new Error("Payouts are temporarily disabled. Please contact support for manual payout processing.");

    // Deduct from account
    const { error: updateError } = await supabaseClient
      .from('player_accounts')
      .update({ balance: balance - amountInCents })
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    // Record transaction
    await supabaseClient
      .from('account_transactions')
      .insert({
        user_id: user.id,
        account_id: account.id,
        amount: -amountInCents,
        transaction_type: 'payout',
        description: `Payout to payment method`,
        stripe_payment_intent_id: paymentIntent.id,
        metadata: { payout_method: 'stripe_refund' }
      });

    logStep("Payout processed successfully");
    return new Response(JSON.stringify({ 
      success: true, 
      newBalance: balance - amountInCents,
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
