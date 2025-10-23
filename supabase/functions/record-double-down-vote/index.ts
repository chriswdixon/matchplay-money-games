import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from 'https://esm.sh/zod@3.22.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RECORD-DOUBLE-DOWN-VOTE] ${step}${detailsStr}`);
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

  try {
    logStep('Function started');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('Authentication failed');
    
    logStep('User authenticated', { userId: user.id });

    // SECURITY: Validate input with Zod schema
    const requestSchema = z.object({
      matchId: z.string().uuid('Invalid match ID format'),
      optedIn: z.boolean()
    });

    const body = await req.json();
    const { matchId, optedIn } = requestSchema.parse(body);

    // Verify user is an active participant
    const { data: participant, error: participantError } = await supabaseClient
      .from('match_participants')
      .select('*')
      .eq('match_id', matchId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (participantError || !participant) {
      throw new Error('You are not an active participant in this match');
    }

    // Verify match is started and not finalized
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .select('status, double_down_finalized, buy_in_amount, double_down_amount')
      .eq('id', matchId)
      .single();

    if (matchError) throw new Error('Match not found');
    if (match.status !== 'started') throw new Error('Match must be started to double down');
    if (match.double_down_finalized) throw new Error('Double down already finalized');

    logStep('Match validated', { matchId, status: match.status });

    // Check if user already responded
    const { data: existing } = await supabaseClient
      .from('double_down_participants')
      .select('*')
      .eq('match_id', matchId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing?.responded) {
      throw new Error('You have already responded to the double down');
    }

    // Calculate double down amount (defaults to match buy-in)
    const doubleDownAmount = match.double_down_amount || match.buy_in_amount;

    // Record vote
    const { error: upsertError } = await supabaseClient
      .from('double_down_participants')
      .upsert({
        match_id: matchId,
        user_id: user.id,
        opted_in: optedIn,
        responded: true,
        additional_buyin: optedIn ? doubleDownAmount : 0,
        payment_processed: false,
      }, {
        onConflict: 'match_id,user_id'
      });

    if (upsertError) throw upsertError;

    logStep('Vote recorded', { optedIn, userId: user.id });

    // Count total active participants
    const { data: allParticipants, error: countError } = await supabaseClient
      .from('match_participants')
      .select('user_id')
      .eq('match_id', matchId)
      .eq('status', 'active');

    if (countError) throw countError;

    const totalParticipants = allParticipants.length;

    // Count responses
    const { data: responses, error: responsesError } = await supabaseClient
      .from('double_down_participants')
      .select('opted_in, responded')
      .eq('match_id', matchId);

    if (responsesError) throw responsesError;

    const respondedCount = responses.filter(r => r.responded).length;
    const allOptedIn = responses.every(r => r.opted_in);
    const anyOptedOut = responses.some(r => r.responded && !r.opted_in);

    logStep('Checking responses', { 
      totalParticipants, 
      respondedCount, 
      allOptedIn,
      anyOptedOut 
    });

    // If all have responded
    if (respondedCount === totalParticipants) {
      if (anyOptedOut) {
        // Cancel double down
        await supabaseClient
          .from('matches')
          .update({ double_down_finalized: true })
          .eq('id', matchId);

        logStep('Double down cancelled - not unanimous');

        return new Response(JSON.stringify({
          allAgreed: false,
          doubleDownCancelled: true,
          message: 'Not all players agreed. Double down cancelled.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else if (allOptedIn) {
        // All agreed - ready for payment processing
        logStep('All players agreed - ready for payment');

        return new Response(JSON.stringify({
          allAgreed: true,
          needsProcessing: true,
          message: 'All players agreed! Processing payments...'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // Still waiting for responses
    const pendingCount = totalParticipants - respondedCount;
    
    return new Response(JSON.stringify({
      waiting: true,
      pendingCount,
      respondedCount,
      totalParticipants,
      message: `Waiting for ${pendingCount} more player${pendingCount !== 1 ? 's' : ''}...`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    logStep('ERROR', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
