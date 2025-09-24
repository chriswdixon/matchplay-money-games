import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { attempts: number; lastAttempt: number }>();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, clientIP } = await req.json();
    
    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password is required', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP for rate limiting (fallback to a default if not provided)
    const ip = clientIP || req.headers.get('x-forwarded-for') || 'unknown';
    
    // Rate limiting: max 5 attempts per hour per IP
    const now = Date.now();
    const rateLimit = rateLimitStore.get(ip);
    
    if (rateLimit) {
      // Reset attempts if more than 1 hour has passed
      if (now - rateLimit.lastAttempt > 3600000) {
        rateLimit.attempts = 0;
      }
      
      // Check if rate limit exceeded
      if (rateLimit.attempts >= 5) {
        console.log(`Rate limit exceeded for IP: ${ip}`);
        return new Response(
          JSON.stringify({ 
            error: 'Too many attempts. Please try again later.', 
            success: false,
            rateLimited: true 
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get the correct password from secrets
    const correctPassword = Deno.env.get('SITE_ACCESS_PASSWORD');
    
    if (!correctPassword) {
      console.error('SITE_ACCESS_PASSWORD secret not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password
    const isValid = password === correctPassword;

    // Update rate limiting
    if (rateLimit) {
      rateLimit.attempts += 1;
      rateLimit.lastAttempt = now;
    } else {
      rateLimitStore.set(ip, { attempts: 1, lastAttempt: now });
    }

    if (isValid) {
      // Generate a simple session token (in production, use JWT or more secure method)
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      console.log(`Successful authentication for IP: ${ip}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Access granted',
          sessionToken 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log(`Failed authentication attempt for IP: ${ip}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'Invalid password', 
          success: false 
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in validate-site-password function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});