import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GOLFCOURSEAPI_KEY');
    
    if (!apiKey) {
      throw new Error('Golf Course API key not configured');
    }

    console.log('[EXPORT-ALL-COURSES] Starting export...');

    // Fetch all courses with pagination
    let allCourses: any[] = [];
    let offset = 0;
    const limit = 100; // Max per request
    let hasMore = true;

    while (hasMore) {
      const apiUrl = `https://api.golfcourseapi.com/v1/courses?limit=${limit}&offset=${offset}`;
      
      console.log(`[EXPORT-ALL-COURSES] Fetching batch: offset=${offset}`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
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
        
        // Safety limit to prevent infinite loops
        if (offset > 50000) {
          console.log('[EXPORT-ALL-COURSES] Reached safety limit');
          hasMore = false;
        }
      }
    }

    console.log(`[EXPORT-ALL-COURSES] Total courses fetched: ${allCourses.length}`);

    // Format courses as text
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

    // Return as downloadable text file
    return new Response(textOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="golf-courses-export.txt"',
      },
    });

  } catch (error) {
    console.error('[EXPORT-ALL-COURSES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
