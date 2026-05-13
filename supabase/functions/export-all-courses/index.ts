import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GOLFCOURSEAPI_KEY');
    if (!apiKey) {
      throw new Error('Golf Course API key not configured');
    }

    console.log('[EXPORT-ALL-COURSES] Starting export...');

    let allCourses: any[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const apiUrl = `https://api.golfcourseapi.com/v1/courses?limit=${limit}&offset=${offset}`;
      console.log(`[EXPORT-ALL-COURSES] Fetching batch: offset=${offset}`);

      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Key ${apiKey}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const courses = data.courses || [];
      console.log(`[EXPORT-ALL-COURSES] Fetched ${courses.length} courses`);

      if (courses.length === 0) {
        hasMore = false;
      } else {
        allCourses = allCourses.concat(courses);
        offset += limit;
        if (offset > 50000) {
          console.log('[EXPORT-ALL-COURSES] Reached safety limit');
          hasMore = false;
        }
      }
    }

    console.log(`[EXPORT-ALL-COURSES] Total courses fetched: ${allCourses.length}`);

    let textOutput = `GOLF COURSE DATABASE EXPORT\n`;
    textOutput += `Total Courses: ${allCourses.length}\n`;
    textOutput += `Export Date: ${new Date().toISOString()}\n`;
    textOutput += `${'='.repeat(80)}\n\n`;

    allCourses.forEach((course, index) => {
      textOutput += `${index + 1}. ${course.name}\n`;
      textOutput += `   ID: ${course.id}\n`;
      if (course.address) textOutput += `   Address: ${course.address}\n`;
      if (course.city) textOutput += `   City: ${course.city}\n`;
      if (course.state) textOutput += `   State: ${course.state}\n`;
      if (course.zip) textOutput += `   Zip: ${course.zip}\n`;
      if (course.country) textOutput += `   Country: ${course.country}\n`;
      if (course.latitude && course.longitude) {
        textOutput += `   Coordinates: ${course.latitude}, ${course.longitude}\n`;
      }
      if (course.phone) textOutput += `   Phone: ${course.phone}\n`;
      if (course.website) textOutput += `   Website: ${course.website}\n`;
      textOutput += `\n`;
    });

    return new Response(textOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="golf-courses-export.txt"',
      },
    });
  } catch (error: any) {
    console.error('[EXPORT-ALL-COURSES] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to export golf courses.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
