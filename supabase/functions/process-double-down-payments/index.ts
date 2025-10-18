import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { z } from 'https://esm.sh/zod@3.22.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-DOUBLE-DOWN-PAYMENTS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2023-10-16',
  });

  try {
    logStep('Function started');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('Authentication failed');

    // SECURITY: Validate input with Zod schema
    const requestSchema = z.object({
      matchId: z.string().uuid('Invalid match ID format')
    });

    const body = await req.json();
    const { matchId } = requestSchema.parse(body);

    logStep('Processing payments for match', { matchId, userId: user.id });

    // SECURITY: Verify user is an active participant in this match
    const { data: userParticipant, error: participantError } = await supabaseClient
      .from('match_participants')
      .select('user_id')
      .eq('match_id', matchId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (participantError || !userParticipant) {
      throw new Error('You are not a participant in this match');
    }

    // SECURITY: Verify user has voted and opted in
    const { data: userVote, error: voteError } = await supabaseClient
      .from('double_down_participants')
      .select('responded, opted_in')
      .eq('match_id', matchId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (voteError || !userVote?.responded || !userVote?.opted_in) {
      throw new Error('You have not voted for double down or did not opt in');
    }

    logStep('User authorization verified', { userId: user.id });

    // CRITICAL VALIDATION: Verify match state
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (matchError) throw new Error('Match not found');
    if (match.double_down_finalized) {
      throw new Error('Double down already finalized');
    }

    // Get all participants
    const { data: participants, error: participantsError } = await supabaseClient
      .from('double_down_participants')
      .select(`
        *,
        profiles!inner(display_name)
      `)
      .eq('match_id', matchId);

    if (participantsError) throw participantsError;

    // SECURITY: Validate participant count
    if (!participants || participants.length === 0 || participants.length > 8) {
      throw new Error('Invalid participant count');
    }

    // SECURITY: Validate payment amounts for all participants
    const paymentSchema = z.object({
      additional_buyin: z.number()
        .int('Amount must be an integer')
        .min(100, 'Minimum buy-in is $1')
        .max(50000, 'Maximum buy-in is $500')
    });

    for (const participant of participants) {
      paymentSchema.parse({ additional_buyin: participant.additional_buyin });
    }

    // CRITICAL: Verify ALL opted in and responded
    const allOptedIn = participants.every(p => p.opted_in && p.responded);
    if (!allOptedIn) {
      throw new Error('Not all participants agreed to double down');
    }

    // Verify none have been processed yet
    const anyProcessed = participants.some(p => p.payment_processed);
    if (anyProcessed) {
      throw new Error('Payments already processed');
    }

    logStep('All participants validated', { count: participants.length });

    // Process each participant's payment
    const processedPayments: any[] = [];
    const failedPayments: any[] = [];

    for (const participant of participants) {
      try {
        logStep('Processing payment for participant', { 
          userId: participant.user_id,
          amount: participant.additional_buyin 
        });

        // Get player account
        const { data: account, error: accountError } = await supabaseClient
          .from('player_accounts')
          .select('*')
          .eq('user_id', participant.user_id)
          .single();

        if (accountError) throw new Error(`Account not found for user ${participant.user_id}`);

        const balanceInCents = parseInt(account.balance.toString());
        const requiredAmount = participant.additional_buyin;

        let chargedVia = 'balance';
        let paymentIntentId = null;

        if (balanceInCents >= requiredAmount) {
          // Sufficient balance - deduct from account
          const { error: updateError } = await supabaseClient
            .from('player_accounts')
            .update({ balance: balanceInCents - requiredAmount })
            .eq('id', account.id);

          if (updateError) throw updateError;

          logStep('Deducted from balance', { 
            userId: participant.user_id, 
            amount: requiredAmount 
          });
        } else {
          // Insufficient balance - charge Stripe
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('user_id', participant.user_id)
            .single();

          // Get user email
          const { data: authUser } = await supabaseClient.auth.admin.getUserById(participant.user_id);
          const userEmail = authUser?.user?.email;

          if (!userEmail) throw new Error('User email not found');

          // Find or create Stripe customer
          const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
          let customerId = customers.data[0]?.id;

          if (!customerId) {
            const customer = await stripe.customers.create({ email: userEmail });
            customerId = customer.id;
          }

          // Create payment intent
          const paymentIntent = await stripe.paymentIntents.create({
            amount: requiredAmount,
            currency: 'usd',
            customer: customerId,
            description: `Double Down - Match ${matchId}`,
            metadata: {
              match_id: matchId,
              user_id: participant.user_id,
              type: 'double_down'
            },
            confirm: true,
            automatic_payment_methods: {
              enabled: true,
              allow_redirects: 'never'
            }
          });

          if (paymentIntent.status !== 'succeeded') {
            throw new Error(`Payment failed: ${paymentIntent.status}`);
          }

          paymentIntentId = paymentIntent.id;
          chargedVia = 'stripe';

          logStep('Charged via Stripe', { 
            userId: participant.user_id, 
            paymentIntentId 
          });
        }

        // Record transaction
        const { error: transactionError } = await supabaseClient
          .from('account_transactions')
          .insert({
            user_id: participant.user_id,
            account_id: account.id,
            amount: -requiredAmount,
            transaction_type: 'double_down',
            match_id: matchId,
            description: `Double Down - Back 9 additional buy-in`,
            stripe_payment_intent_id: paymentIntentId
          });

        if (transactionError) throw transactionError;

        // Mark as processed
        const { error: updateParticipantError } = await supabaseClient
          .from('double_down_participants')
          .update({ 
            payment_processed: true,
            payment_intent_id: paymentIntentId
          })
          .eq('id', participant.id);

        if (updateParticipantError) throw updateParticipantError;

        processedPayments.push({
          userId: participant.user_id,
          amount: requiredAmount,
          chargedVia,
          paymentIntentId
        });

        logStep('Payment processed successfully', { userId: participant.user_id });

      } catch (paymentError: any) {
        logStep('Payment failed for participant', { 
          userId: participant.user_id, 
          error: paymentError.message 
        });
        
        failedPayments.push({
          userId: participant.user_id,
          error: paymentError.message
        });
        
        // If any payment fails, we need to rollback
        throw new Error(`Payment failed for user ${participant.user_id}: ${paymentError.message}`);
      }
    }

    // All payments successful - finalize double down
    const { error: finalizeError } = await supabaseClient
      .from('matches')
      .update({ double_down_finalized: true })
      .eq('id', matchId);

    if (finalizeError) throw finalizeError;

    logStep('All payments processed successfully', { count: processedPayments.length });

    return new Response(JSON.stringify({
      success: true,
      processedPayments,
      message: 'Double down activated! All payments processed.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    logStep('ERROR', { message: error.message });
    
    // Rollback any successful payments
    if (processedPayments.length > 0) {
      logStep('Rolling back payments', { count: processedPayments.length });
      
      for (const payment of processedPayments) {
        try {
          if (payment.chargedVia === 'stripe' && payment.paymentIntentId) {
            // Refund Stripe payment
            await stripe.refunds.create({
              payment_intent: payment.paymentIntentId,
              reason: 'requested_by_customer',
            });
            logStep('Refunded Stripe payment', { userId: payment.userId });
          } else {
            // Restore balance deduction
            const { data: account } = await supabaseClient
              .from('player_accounts')
              .select('id, balance')
              .eq('user_id', payment.userId)
              .single();
            
            if (account) {
              await supabaseClient
                .from('player_accounts')
                .update({ balance: parseInt(account.balance.toString()) + payment.amount })
                .eq('id', account.id);
              logStep('Restored balance', { userId: payment.userId, amount: payment.amount });
            }
          }
          
          // Remove transaction record
          await supabaseClient
            .from('account_transactions')
            .delete()
            .eq('user_id', payment.userId)
            .eq('match_id', matchId)
            .eq('transaction_type', 'double_down')
            .eq('stripe_payment_intent_id', payment.paymentIntentId);
          
          // Mark as not processed
          await supabaseClient
            .from('double_down_participants')
            .update({ payment_processed: false, payment_intent_id: null })
            .eq('match_id', matchId)
            .eq('user_id', payment.userId);
            
        } catch (rollbackError: any) {
          logStep('Rollback failed', { userId: payment.userId, error: rollbackError.message });
        }
      }
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      rolledBack: processedPayments.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
