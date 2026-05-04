import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const safeMessages = new Set([
  "No authorization header",
  "Not authenticated",
  "Unauthorized: Admin access required",
  "Cannot ban another admin",
  "Cannot ban yourself",
]);

const getSafeErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  return safeMessages.has(message) ? message : "Unable to update user.";
};

const getStatusCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (message === "No authorization header" || message === "Not authenticated") return 401;
  if (message === "Unauthorized: Admin access required") return 403;
  if (message === "Cannot ban another admin" || message === "Cannot ban yourself") return 400;
  return 500;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const actingUser = userData.user;
    if (!actingUser) throw new Error("Not authenticated");

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", actingUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) throw new Error("Unauthorized: Admin access required");

    const requestSchema = z.object({
      userId: z.string().uuid("Invalid user ID format"),
      action: z.enum(["ban", "unban"]).default("ban"),
      reason: z.string().max(500).optional(),
    });

    const requestBody = await req.json();
    const { userId, action, reason } = requestSchema.parse(requestBody);

    if (action === "ban" && userId === actingUser.id) {
      throw new Error("Cannot ban yourself");
    }

    // Don't allow banning another admin
    if (action === "ban") {
      const { data: targetAdmin } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (targetAdmin) throw new Error("Cannot ban another admin");
    }

    // Ban / unban via Supabase auth admin API.
    // ban_duration uses Go duration string. Use a very long duration for "permanent".
    const banDuration = action === "ban" ? "876000h" : "none"; // ~100 years vs lift ban
    const { error: authErr } = await supabaseClient.auth.admin.updateUserById(userId, {
      ban_duration: banDuration,
    } as any);
    if (authErr) throw authErr;

    // Mirror status in profile data for UI/subscription gating
    await supabaseClient
      .from("private_profile_data")
      .update({ membership_tier: action === "ban" ? "disabled" : "Free" })
      .eq("user_id", userId);

    // Best-effort sign the user out of all active sessions when banning
    if (action === "ban") {
      try {
        await supabaseClient.auth.admin.signOut(userId, "global" as any);
      } catch (_) {
        // ignore — sessions will fail next refresh anyway
      }
    }

    // Audit log
    try {
      await supabaseClient.from("audit_log").insert({
        actor_id: actingUser.id,
        user_id: userId,
        event_type: action === "ban" ? "user_banned" : "user_unbanned",
        category: "admin",
        summary: action === "ban"
          ? `Admin banned user ${userId}${reason ? `: ${reason}` : ""}`
          : `Admin unbanned user ${userId}`,
        payload: { reason: reason || null },
      });
    } catch (_) {
      // non-fatal
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: action === "ban" ? "User banned successfully" : "User unbanned successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error in admin-disable-user:", error);

    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: "Invalid user data" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    return new Response(
      JSON.stringify({ error: getSafeErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: getStatusCode(error) }
    );
  }
});
