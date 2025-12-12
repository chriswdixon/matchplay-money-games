import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 30;
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Verify user has admin role
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('[CREATE-GOLF-COURSE] Role check error:', roleError);
      throw new Error('Authorization check failed');
    }

    if (!roleData) {
      console.log('[CREATE-GOLF-COURSE] Unauthorized access attempt', { userId: user.id });
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized: Admin access required",
          code: "UNAUTHORIZED"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403 
        }
      );
    }

    // Check rate limit
    if (isRateLimited(user.id)) {
      console.log('[CREATE-GOLF-COURSE] Rate limit exceeded', { userId: user.id });
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429 
        }
      );
    }

    // Validate input with Zod
    const courseSchema = z.object({
      name: z.string().trim().min(1, 'Course name is required').max(200, 'Course name too long'),
      address: z.string().trim().min(1, 'Address is required').max(500, 'Address too long'),
      city: z.string().trim().max(100).optional(),
      state: z.string().trim().max(50).optional(),
      zip: z.string().trim().max(20).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      phone: z.string().trim().max(50).optional(),
      website: z.string().trim().url().max(500).optional().or(z.literal(''))
    });

    const requestBody = await req.json();
    const validatedData = courseSchema.parse(requestBody);

    console.log('[CREATE-GOLF-COURSE] Creating course:', validatedData.name);

    // Insert the new course
    const { data: course, error: insertError } = await supabase
      .from('golf_courses')
      .insert({
        name: validatedData.name,
        address: validatedData.address,
        city: validatedData.city || null,
        state: validatedData.state || null,
        zip: validatedData.zip || null,
        latitude: validatedData.latitude || null,
        longitude: validatedData.longitude || null,
        phone: validatedData.phone || null,
        website: validatedData.website || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[CREATE-GOLF-COURSE] Insert error:', insertError);
      throw insertError;
    }

    console.log('[CREATE-GOLF-COURSE] Course created:', course.id);

    return new Response(
      JSON.stringify({ success: true, course }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[CREATE-GOLF-COURSE] Error:', error);
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: "Invalid course data provided",
          code: "VALIDATION_ERROR"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }
    
    // Sanitize all other errors
    return new Response(
      JSON.stringify({ 
        error: "Unable to create golf course",
        code: "OPERATION_FAILED"
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
