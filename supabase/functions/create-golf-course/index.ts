import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    const { name, address, city, state, zip, latitude, longitude, phone, website } = await req.json();

    // Validate required fields
    if (!name || !address) {
      throw new Error('Course name and address are required');
    }

    // Validate input lengths
    if (name.length > 200) {
      throw new Error('Course name must be less than 200 characters');
    }
    if (address.length > 500) {
      throw new Error('Address must be less than 500 characters');
    }

    console.log('[CREATE-GOLF-COURSE] Creating course:', name);

    // Insert the new course
    const { data: course, error: insertError } = await supabase
      .from('golf_courses')
      .insert({
        name: name.trim(),
        address: address.trim(),
        city: city?.trim() || null,
        state: state?.trim() || null,
        zip: zip?.trim() || null,
        latitude: latitude || null,
        longitude: longitude || null,
        phone: phone?.trim() || null,
        website: website?.trim() || null,
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
