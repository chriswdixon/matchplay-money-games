import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { token } = await req.json();

    if (!token) {
      throw new Error("Token is required");
    }

    // Find the token
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from("age_verification_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (tokenError || !tokenData) {
      console.error("Token lookup error:", tokenError);
      throw new Error("Invalid or expired verification token");
    }

    // Check if already verified
    if (tokenData.verified) {
      return new Response(
        JSON.stringify({ success: true, message: "Age already verified", alreadyVerified: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error("Verification token has expired. Please request a new one.");
    }

    // Mark token as verified
    const { error: updateTokenError } = await supabaseClient
      .from("age_verification_tokens")
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    if (updateTokenError) {
      console.error("Token update error:", updateTokenError);
      throw new Error("Failed to verify token");
    }

    // Update user profile as age verified
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .update({
        age_verified: true,
        age_verified_at: new Date().toISOString(),
      })
      .eq("user_id", tokenData.user_id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      throw new Error("Failed to update profile verification status");
    }

    console.log(`Age verified for user ${tokenData.user_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Age successfully verified! You can now access all MatchPlay features." 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error verifying age token:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
