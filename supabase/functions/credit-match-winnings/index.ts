import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREDIT-WINNINGS] ${step}${detailsStr}`);
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

    const { matchId } = await req.json();
    if (!matchId) throw new Error("Missing matchId");

    // Get match details
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .select('*, match_results(*)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) throw new Error("Match not found");
    if (match.status !== 'completed') throw new Error("Match not completed");

    const matchResults = match.match_results?.[0];
    if (!matchResults || !matchResults.winner_id) {
      throw new Error("No winner found for this match");
    }

    const winnerId = matchResults.winner_id;
    const buyInAmount = match.buy_in_amount;

    logStep("Processing winnings", { matchId, winnerId, buyInAmount });

    // Count active participants (who actually paid buy-in)
    const { data: participants, error: participantsError } = await supabaseClient
      .from('match_participants')
      .select('user_id')
      .eq('match_id', matchId)
      .eq('status', 'active');

    if (participantsError) throw participantsError;

    const totalPot = buyInAmount * (participants?.length || 0);
    logStep("Calculated pot", { participantCount: participants?.length, totalPot });

    // Note: Unique constraint on (match_id, user_id, transaction_type) 
    // will prevent duplicates at database level

    // Get winner's account
    const { data: account } = await supabaseClient
      .from('player_accounts')
      .select('*')
      .eq('user_id', winnerId)
      .single();

    if (!account) throw new Error("Winner account not found");

    const currentBalance = parseFloat(account.balance);
    const newBalance = currentBalance + totalPot;

    // Credit winnings
    const { error: updateError } = await supabaseClient
      .from('player_accounts')
      .update({ balance: newBalance })
      .eq('user_id', winnerId);

    if (updateError) throw updateError;

    // Record transaction - unique constraint prevents duplicates
    const { error: txError } = await supabaseClient
      .from('account_transactions')
      .insert({
        user_id: winnerId,
        account_id: account.id,
        amount: totalPot,
        transaction_type: 'winning',
        match_id: matchId,
        description: `Match winnings for ${matchId}`,
        metadata: { 
          participant_count: participants?.length,
          buy_in_amount: buyInAmount
        }
      });
    
    if (txError) {
      // Check if it's a duplicate transaction error
      if (txError.code === '23505') {
        logStep("Duplicate winnings credit detected");
        return new Response(JSON.stringify({ 
          success: true,
          message: "Winnings already credited",
          amount: totalPot
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      throw txError;
    }

    logStep("Winnings credited successfully");
    return new Response(JSON.stringify({ 
      success: true, 
      winnerId,
      amount: totalPot,
      newBalance
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    // Sanitize error messages for security
    let safeMessage = "Unable to process winnings";
    if (errorMessage.includes('not found') || errorMessage.includes('not authenticated')) {
      safeMessage = "Resource not available";
    } else if (errorMessage.includes('not completed')) {
      safeMessage = "Operation not allowed";
    }
    
    return new Response(JSON.stringify({ 
      error: safeMessage,
      code: "OPERATION_FAILED"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
