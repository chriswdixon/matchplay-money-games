// Simulate 3 bot opponents for a 1-player "testing mode" match.
// Bots auto-join, score +1 over par on every hole, and pre-confirm results.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SIMULATE-BOTS] ${step}${d}`);
};

const BOT_PROFILES = [
  { display_name: "Bogey Bot", handicap: 12, sort_order: 1 },
  { display_name: "Birdie Bot", handicap: 10, sort_order: 2 },
  { display_name: "Par Bot",    handicap: 14, sort_order: 3 },
];

const RequestSchema = z.object({
  matchId: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { matchId } = RequestSchema.parse(body);
    log("start", { matchId, userId: user.id });

    // Load and validate match
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .select("id, created_by, max_participants, status, holes, hole_pars")
      .eq("id", matchId)
      .single();

    if (mErr || !match) throw new Error("Match not found");
    if (match.created_by !== user.id) throw new Error("Forbidden");
    if (match.status !== "open") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "match_not_open" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the creator is the only active participant (true solo scenario)
    const { count: activeCount, error: countErr } = await supabase
      .from("match_participants")
      .select("user_id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("status", "active");
    if (countErr) throw new Error(`Failed to count participants: ${countErr.message}`);
    if ((activeCount ?? 0) > 1) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "match_has_other_players" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Provision bots if needed
    const { data: existingBots } = await supabase
      .from("bot_users")
      .select("user_id, display_name, sort_order")
      .order("sort_order", { ascending: true });

    const bots: { user_id: string; display_name: string; sort_order: number }[] =
      existingBots ?? [];

    for (const bp of BOT_PROFILES) {
      if (bots.find((b) => b.sort_order === bp.sort_order)) continue;
      log("provisioning bot", bp);
      const email = `bot-${bp.sort_order}-${crypto.randomUUID().slice(0, 8)}@bots.tyche.local`;
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { is_bot: true, display_name: bp.display_name },
      });
      if (createErr || !created.user) {
        throw new Error(`Failed to create bot: ${createErr?.message}`);
      }
      const botId = created.user.id;

      // Profile, private data, account, bot record
      await supabase.from("profiles").upsert({
        user_id: botId,
        display_name: bp.display_name,
        handicap: bp.handicap,
        first_name: bp.display_name.split(" ")[0],
        last_name: "Bot",
        age_verified: true,
      }, { onConflict: "user_id" });

      await supabase.from("player_accounts").upsert({
        user_id: botId,
        balance: 0,
      }, { onConflict: "user_id" });

      await supabase.from("bot_users").insert({
        user_id: botId,
        display_name: bp.display_name,
        sort_order: bp.sort_order,
      });

      bots.push({ user_id: botId, display_name: bp.display_name, sort_order: bp.sort_order });
    }

    bots.sort((a, b) => a.sort_order - b.sort_order);
    const toAdd = bots.slice(0, 3);

    // Insert participants (idempotent)
    const participantsRows = toAdd.map((b) => ({
      match_id: matchId,
      user_id: b.user_id,
      status: "active",
    }));
    const { error: pErr } = await supabase
      .from("match_participants")
      .upsert(participantsRows, { onConflict: "match_id,user_id" });
    if (pErr) throw new Error(`Failed to add bot participants: ${pErr.message}`);

    // Ensure max_participants accommodates human + bots so start_match can proceed.
    const requiredMax = 1 + toAdd.length;
    if ((match.max_participants ?? 0) < requiredMax) {
      const { error: mUpdErr } = await supabase
        .from("matches")
        .update({ max_participants: requiredMax })
        .eq("id", matchId);
      if (mUpdErr) throw new Error(`Failed to bump max_participants: ${mUpdErr.message}`);
    }

    // Build par+1 scores per hole
    const holes = match.holes ?? 18;
    const holePars = (match.hole_pars ?? {}) as Record<string, number>;
    const scoreRows: { match_id: string; player_id: string; hole_number: number; strokes: number }[] = [];
    for (const b of toAdd) {
      for (let h = 1; h <= holes; h++) {
        const par = holePars[String(h)] ?? 4;
        scoreRows.push({
          match_id: matchId,
          player_id: b.user_id,
          hole_number: h,
          strokes: par + 1,
        });
      }
    }
    const { error: sErr } = await supabase
      .from("match_scores")
      .upsert(scoreRows, { onConflict: "match_id,player_id,hole_number" });
    if (sErr) throw new Error(`Failed to insert bot scores: ${sErr.message}`);

    // Pre-confirm bots so the human's confirmation triggers finalization
    const confirmRows = toAdd.map((b) => ({
      match_id: matchId,
      player_id: b.user_id,
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    }));
    const { error: cErr } = await supabase
      .from("match_confirmations")
      .upsert(confirmRows, { onConflict: "match_id,player_id" });
    if (cErr) throw new Error(`Failed to confirm bots: ${cErr.message}`);

    log("done", { added: toAdd.length, scores: scoreRows.length });

    return new Response(
      JSON.stringify({
        success: true,
        bots: toAdd.map((b) => ({ user_id: b.user_id, display_name: b.display_name })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    const safeMessages = new Set(["Unauthorized", "Forbidden", "Match not found"]);
    const status = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : msg === "Match not found" ? 404 : 500;
    const safeMsg = safeMessages.has(msg) ? msg : "Unable to simulate match. Please try again.";
    return new Response(
      JSON.stringify({ error: safeMsg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
