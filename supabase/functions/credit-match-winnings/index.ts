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

    // Check if winnings already credited
    const { data: existingTransaction } = await supabaseClient
      .from('account_transactions')
      .select('id')
      .eq('match_id', matchId)
      .eq('transaction_type', 'winning')
      .eq('user_id', winnerId)
      .maybeSingle();

    if (existingTransaction) {
      logStep("Winnings already credited");
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Winnings already credited",
        alreadyProcessed: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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

    // Record transaction
    await supabaseClient
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
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
