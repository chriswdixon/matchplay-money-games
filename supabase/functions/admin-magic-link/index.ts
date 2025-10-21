import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting for admin auth operations
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization")!;
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

    // Check rate limit
    if (isRateLimited(user.id)) {
      return new Response(
        JSON.stringify({ 
          error: "Too many authentication attempts. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 429 }
      );
    }

    // Validate input
    const requestSchema = z.object({
      userEmail: z.string().email('Invalid email format').max(254, 'Email too long')
    });
    
    const requestBody = await req.json();
    const { userEmail } = requestSchema.parse(requestBody);

    // Send magic link
    const { error: magicLinkError } = await supabaseClient.auth.signInWithOtp({
      email: userEmail,
      options: {
        emailRedirectTo: `${req.headers.get("origin")}/`,
      },
    });

    if (magicLinkError) throw magicLinkError;

    return new Response(
      JSON.stringify({ success: true, message: "Magic link sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in admin-magic-link:", error);
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid email address",
          code: "VALIDATION_ERROR"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
    
    // Sanitize all other errors
    return new Response(
      JSON.stringify({ 
        error: "Unable to process request",
        code: "OPERATION_FAILED"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
