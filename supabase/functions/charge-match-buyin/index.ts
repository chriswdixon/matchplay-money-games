import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHARGE-BUYIN] ${step}${detailsStr}`);
};

// Rate limiting
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const isRateLimited = (userId: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimitCache.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitCache.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return true;
  }
  
  userLimit.count++;
  return false;
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

    // Check rate limit
    if (isRateLimited(user.id)) {
      logStep("Rate limit exceeded", { userId: user.id });
      return new Response(JSON.stringify({ 
        error: "Too many payment attempts. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Validate input with Zod
    const MAX_BUY_IN_CENTS = 50000; // $500 in cents
    const requestSchema = z.object({
      matchId: z.string().uuid({ message: 'Invalid match ID format' }),
      buyInAmount: z.number().int().min(0).max(MAX_BUY_IN_CENTS, { 
        message: `Buy-in amount must be between $0 and $${MAX_BUY_IN_CENTS / 100}` 
      })
    });

    const requestBody = await req.json();
    const { matchId, buyInAmount } = requestSchema.parse(requestBody);
    
    logStep("Processing buy-in", { matchId, buyInAmount });

    // Verify user is an active participant in the match
    const { data: participant, error: participantError } = await supabaseClient
      .from('match_participants')
      .select('id')
      .eq('match_id', matchId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (participantError) throw participantError;
    if (!participant) {
      throw new Error('You must be an active participant to pay the buy-in for this match');
    }

    // Verify match is in correct state and buy-in amount matches
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .select('status, buy_in_amount')
      .eq('id', matchId)
      .single();

    if (matchError) throw matchError;
    if (match.status !== 'open') {
      throw new Error('Cannot pay buy-in for non-open matches');
    }
    if (match.buy_in_amount !== buyInAmount) {
      throw new Error('Buy-in amount does not match match requirements');
    }

    // Note: Unique constraint on (match_id, user_id, transaction_type) 
    // will prevent duplicates at database level

    // Get or create player account
    const { data: account, error: accountError } = await supabaseClient
      .from('player_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (accountError) {
      logStep("Creating new account");
      const { data: newAccount, error: createError } = await supabaseClient
        .from('player_accounts')
        .insert({ user_id: user.id, balance: 0 })
        .select()
        .single();
      
      if (createError) throw createError;
    }

    // Refresh account data
    const { data: currentAccount } = await supabaseClient
      .from('player_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();

    const balance = parseFloat(currentAccount?.balance || '0');
    logStep("Current balance", { balance, buyInAmount });

    if (balance >= buyInAmount) {
      // Sufficient balance - deduct from account
      logStep("Sufficient balance, deducting from account");
      
      const { error: updateError } = await supabaseClient
        .from('player_accounts')
        .update({ balance: balance - buyInAmount })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Record transaction - unique constraint prevents duplicates
      const { error: txError } = await supabaseClient
        .from('account_transactions')
        .insert({
          user_id: user.id,
          account_id: currentAccount.id,
          amount: -buyInAmount,
          transaction_type: 'match_buyin',
          match_id: matchId,
          description: `Buy-in for match ${matchId}`
        });
      
      if (txError) {
        // Check if it's a duplicate transaction error
        if (txError.code === '23505') {
          logStep("Duplicate transaction detected");
          return new Response(JSON.stringify({ 
            success: true,
            message: "Buy-in already processed",
            chargedFrom: 'balance'
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        throw txError;
      }

      logStep("Buy-in charged from balance");
      return new Response(JSON.stringify({ 
        success: true, 
        chargedFrom: 'balance',
        newBalance: balance - buyInAmount 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // Insufficient balance - charge Stripe
      logStep("Insufficient balance, charging Stripe");
      
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      // Find Stripe customer
      const customers = await stripe.customers.list({ 
        email: user.email!, 
        limit: 1 
      });

      if (customers.data.length === 0) {
        throw new Error("No Stripe customer found. Please add a payment method first.");
      }

      const customerId = customers.data[0].id;

      // Create payment intent with idempotency key
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(buyInAmount), // Already in cents
        currency: 'usd',
        customer: customerId,
        description: `Match buy-in for ${matchId}`,
        metadata: { 
          match_id: matchId, 
          user_id: user.id 
        },
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      }, {
        idempotencyKey: `match_buyin_${matchId}_${user.id}`,
      });

      if (paymentIntent.status !== 'succeeded') {
        throw new Error("Payment failed");
      }

      // Record transaction - unique constraint prevents duplicates
      const { error: txError } = await supabaseClient
        .from('account_transactions')
        .insert({
          user_id: user.id,
          account_id: currentAccount.id,
          amount: -buyInAmount,
          transaction_type: 'match_buyin',
          match_id: matchId,
          description: `Buy-in for match ${matchId} (charged to card)`,
          stripe_payment_intent_id: paymentIntent.id
        });
      
      if (txError) {
        // Check if it's a duplicate transaction error
        if (txError.code === '23505') {
          logStep("Duplicate transaction detected");
          return new Response(JSON.stringify({ 
            success: true,
            message: "Buy-in already processed",
            chargedFrom: 'stripe'
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
        throw txError;
      }

      logStep("Buy-in charged from Stripe");
      return new Response(JSON.stringify({ 
        success: true, 
        chargedFrom: 'stripe',
        paymentIntentId: paymentIntent.id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ 
        error: "Invalid request data",
        code: "VALIDATION_ERROR"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    
    // Sanitize all error messages - never expose internal details
    return new Response(JSON.stringify({ 
      error: "Unable to process payment",
      code: "OPERATION_FAILED"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
