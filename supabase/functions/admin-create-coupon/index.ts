import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const couponRequestSchema = z.object({
  name: z.string().trim().min(1).max(50).regex(/^[A-Za-z0-9 _-]+$/, "Invalid coupon name"),
  tier: z.enum(["local", "tournament"]),
});

const safeMessages = new Set([
  "No authorization header",
  "Not authenticated",
  "Unauthorized: Admin access required",
]);

const getSafeErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  return safeMessages.has(message) ? message : "Unable to create coupon.";
};

const getStatusCode = (error: unknown) => {
  const message = error instanceof Error ? error.message : "";
  if (message === "No authorization header" || message === "Not authenticated") {
    return 401;
  }
  if (message === "Unauthorized: Admin access required") {
    return 403;
  }
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

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    
    if (!user) throw new Error("Not authenticated");

    // Check admin role
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) throw new Error("Unauthorized: Admin access required");

    // Get coupon details from request
    const parsedBody = couponRequestSchema.safeParse(await req.json());
    if (!parsedBody.success) {
      console.error("Invalid coupon request:", parsedBody.error);
      return new Response(
        JSON.stringify({ error: "Invalid coupon input" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { name, tier } = parsedBody.data;

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Create 30-day trial coupon (100% off for 1 month)
    const coupon = await stripe.coupons.create({
      name: `${name} - ${tier === 'local' ? 'Local Player' : 'Tournament Pro'} 30-Day Trial`,
      percent_off: 100,
      duration: "repeating",
      duration_in_months: 1,
      metadata: {
        tier: tier,
        created_by: user.id,
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        coupon: {
          id: coupon.id,
          name: coupon.name,
          percent_off: coupon.percent_off,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in admin-create-coupon:", error);
    return new Response(
      JSON.stringify({ error: getSafeErrorMessage(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: getStatusCode(error) }
    );
  }
});
