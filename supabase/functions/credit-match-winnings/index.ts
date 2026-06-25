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

    // Authorization: only match creator or admin can trigger payout
    const isCreator = match.created_by === user.id;
    let isAdmin = false;
    if (!isCreator) {
      const { data: roleRow } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      isAdmin = !!roleRow;
    }
    if (!isCreator && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized', code: 'FORBIDDEN' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Note: testing-mode (max_participants === 1) matches still process payouts
    // when bot opponents have been added by simulate-bot-match. Pot is computed
    // from active match_participants below.

    const matchResults = match.match_results?.[0];
    if (!matchResults) {
      throw new Error("No results found for this match");
    }

    // Defense-in-depth: only pay out results that were finalized by the trusted
    // server-side finalize flow (finalized_at is set exclusively by
    // finalize_match_results). This prevents payouts on forged/non-finalized results.
    if (!matchResults.finalized_at) {
      throw new Error("Match results have not been finalized");
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
      // Get winner's account (for the account_id reference on the transaction record)
      const { data: account } = await supabaseClient
        .from('player_accounts')
        .select('id')
        .eq('user_id', winnerId)
        .single();

      if (!account) {
        logStep("Warning: Winner account not found", { winnerId });
        continue;
      }

      // Insert transaction FIRST so the unique constraint protects against double-payout.
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
        if (txError.code === '23505') {
          logStep("Duplicate winnings credit detected for winner", { winnerId });
          continue;
        }
        throw txError;
      }

      // Now atomically credit the balance
      const { data: creditRows, error: creditError } = await supabaseClient
        .rpc('credit_player_balance', { _user_id: winnerId, _amount: payoutPerWinner });

      if (creditError) {
        logStep("Error crediting balance", { winnerId, error: creditError });
        throw creditError;
      }

      const credited = Array.isArray(creditRows) && creditRows.length > 0 ? creditRows[0] : null;
      logStep("Winnings credited to winner", { winnerId, amount: payoutPerWinner, newBalance: credited?.balance });
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
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    // Persist failure to audit_log_alerts so admins are notified.
    // Best-effort: never let alerting failures shadow the original error.
    try {
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      let matchIdForAlert: string | null = null;
      try {
        const cloned = await req.clone().json();
        if (cloned && typeof cloned.matchId === "string") matchIdForAlert = cloned.matchId;
      } catch (_) { /* body unavailable */ }

      await adminClient.from("audit_log_alerts").insert({
        match_id: matchIdForAlert,
        expected_event: "match_payout",
        severity: error instanceof z.ZodError ? "warning" : "critical",
        source_table: "match_results",
        status: "open",
        details: {
          source: "credit-match-winnings",
          error: errorMessage,
          error_kind: error instanceof z.ZodError ? "validation" : "runtime",
          at: new Date().toISOString(),
        },
      });
    } catch (alertErr) {
      console.error("[CREDIT-WINNINGS] Failed to write audit alert", alertErr);
    }

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
