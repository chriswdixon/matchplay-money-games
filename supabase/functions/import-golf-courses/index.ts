import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      throw new Error('Unauthorized: Admin access required');
    }

    console.log('[IMPORT-GOLF-COURSES] Starting import by admin:', user.id);

    // Call export-all-courses function
    const exportResponse = await fetch(`${supabaseUrl}/functions/v1/export-all-courses`, {
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!exportResponse.ok) {
      throw new Error(`Export function failed: ${exportResponse.status}`);
    }

    const exportText = await exportResponse.text();
    console.log('[IMPORT-GOLF-COURSES] Received export data, parsing...');

    // Parse the text file
    const lines = exportText.split('\n');
    const courses: any[] = [];
    let currentCourse: any = null;

    for (const line of lines) {
      if (line.match(/^\d+\. /)) {
        // New course entry
        if (currentCourse) {
          courses.push(currentCourse);
        }
        currentCourse = {
          name: line.replace(/^\d+\. /, '').trim(),
        };
      } else if (currentCourse && line.trim()) {
        // Parse course details
        if (line.includes('ID:')) {
          currentCourse.external_id = line.split('ID:')[1].trim();
        } else if (line.includes('Address:')) {
          currentCourse.address = line.split('Address:')[1].trim();
        } else if (line.includes('City:')) {
          currentCourse.city = line.split('City:')[1].trim();
        } else if (line.includes('State:')) {
          currentCourse.state = line.split('State:')[1].trim();
        } else if (line.includes('Zip:')) {
          currentCourse.zip = line.split('Zip:')[1].trim();
        } else if (line.includes('Country:')) {
          currentCourse.country = line.split('Country:')[1].trim();
        } else if (line.includes('Coordinates:')) {
          const coords = line.split('Coordinates:')[1].trim().split(',');
          currentCourse.latitude = parseFloat(coords[0]);
          currentCourse.longitude = parseFloat(coords[1]);
        } else if (line.includes('Phone:')) {
          currentCourse.phone = line.split('Phone:')[1].trim();
        } else if (line.includes('Website:')) {
          currentCourse.website = line.split('Website:')[1].trim();
        }
      }
    }
    if (currentCourse) {
      courses.push(currentCourse);
    }

    console.log(`[IMPORT-GOLF-COURSES] Parsed ${courses.length} courses, upserting...`);

    // Upsert courses in batches
    const batchSize = 100;
    let imported = 0;
    let updated = 0;

    for (let i = 0; i < courses.length; i += batchSize) {
      const batch = courses.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('golf_courses')
        .upsert(batch, {
          onConflict: 'external_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`[IMPORT-GOLF-COURSES] Batch error:`, error);
      } else {
        imported += batch.length;
      }
    }

    console.log(`[IMPORT-GOLF-COURSES] Import complete: ${imported} courses`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total: courses.length,
        message: `Successfully imported ${imported} golf courses`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('[IMPORT-GOLF-COURSES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
