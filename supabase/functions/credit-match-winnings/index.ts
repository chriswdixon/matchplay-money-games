import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREDIT-WINNINGS] ${step}${detailsStr}`);
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
        error: "Too many requests. Please try again later.",
        code: "RATE_LIMIT_EXCEEDED"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Validate input with Zod
    const requestSchema = z.object({
      matchId: z.string().uuid({ message: 'Invalid match ID format' })
    });

    const requestBody = await req.json();
    const { matchId } = requestSchema.parse(requestBody);

    // Get match details
    const { data: match, error: matchError } = await supabaseClient
      .from('matches')
      .select('*, match_results(*)')
      .eq('id', matchId)
      .single();

    if (matchError || !match) throw new Error("Match not found");
    if (match.status !== 'completed') throw new Error("Match not completed");

    // Skip payouts for testing mode (1 player)
    if (match.max_participants === 1) {
      logStep("Testing mode detected - skipping payouts");
      return new Response(JSON.stringify({ 
        success: true,
        testing_mode: true,
        message: "Testing mode: No payouts processed"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const matchResults = match.match_results?.[0];
    if (!matchResults) {
      throw new Error("No results found for this match");
    }

    const buyInAmount = match.buy_in_amount;
    const isTeamFormat = match.is_team_format || false;

    // Count active participants (who actually paid buy-in)
    const { data: participants, error: participantsError } = await supabaseClient
      .from('match_participants')
      .select('user_id')
      .eq('match_id', matchId)
      .eq('status', 'active');

    if (participantsError) throw participantsError;

    const totalPot = buyInAmount * (participants?.length || 0);
    logStep("Calculated pot", { participantCount: participants?.length, totalPot, isTeamFormat });

    // Get winners array (supports ties and team formats)
    const winners = matchResults.winners || (matchResults.winner_id ? [matchResults.winner_id] : []);
    
    if (winners.length === 0) {
      throw new Error("No winners found for this match");
    }

    logStep("Processing winnings", { matchId, winners, buyInAmount, isTeamFormat });

    // Calculate payout per winner
    let payoutPerWinner = totalPot;
    
    if (isTeamFormat) {
      // Team formats: winning team splits the pot
      // If it's a tie, all players split evenly
      payoutPerWinner = Math.floor(totalPot / winners.length);
    } else {
      // Individual formats: winners split the pot evenly (handles ties)
      payoutPerWinner = Math.floor(totalPot / winners.length);
    }

    logStep("Calculated payouts", { totalPot, winnerCount: winners.length, payoutPerWinner });

    // Credit each winner
    for (const winnerId of winners) {
      // Get winner's account
      const { data: account } = await supabaseClient
        .from('player_accounts')
        .select('*')
        .eq('user_id', winnerId)
        .single();

      if (!account) {
        logStep("Warning: Winner account not found", { winnerId });
        continue;
      }

      const currentBalance = parseFloat(account.balance);
      const newBalance = currentBalance + payoutPerWinner;

      // Credit winnings
      const { error: updateError } = await supabaseClient
        .from('player_accounts')
        .update({ balance: newBalance })
        .eq('user_id', winnerId);

      if (updateError) {
        logStep("Error updating balance", { winnerId, error: updateError });
        throw updateError;
      }

      // Record transaction - unique constraint prevents duplicates
      const { error: txError } = await supabaseClient
        .from('account_transactions')
        .insert({
          user_id: winnerId,
          account_id: account.id,
          amount: payoutPerWinner,
          transaction_type: 'winning',
          match_id: matchId,
          description: `Match winnings for ${matchId}${winners.length > 1 ? ' (split)' : ''}`,
          metadata: { 
            participant_count: participants?.length,
            buy_in_amount: buyInAmount,
            winner_count: winners.length,
            is_team_format: isTeamFormat,
            is_tie: winners.length > 1 && !isTeamFormat
          }
        });
      
      if (txError) {
        // Check if it's a duplicate transaction error
        if (txError.code === '23505') {
          logStep("Duplicate winnings credit detected for winner", { winnerId });
          continue;
        }
        throw txError;
      }

      logStep("Winnings credited to winner", { winnerId, amount: payoutPerWinner, newBalance });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      winners,
      totalPot,
      payoutPerWinner,
      isTeamFormat,
      message: winners.length > 1 ? "Winnings split among winners" : "Winner credited"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
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
      error: "Unable to process request",
      code: "OPERATION_FAILED"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
