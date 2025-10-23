import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const { courseId } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get course data
    const { data: course, error: courseError } = await supabaseClient
      .from('golf_courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError) throw courseError;

    // Use AI to clean and standardize data
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const prompt = `Clean and standardize this golf course data:

Current Data:
Name: ${course.name}
Address: ${course.address || 'N/A'}
City: ${course.city || 'N/A'}
State: ${course.state || 'N/A'}
Zip: ${course.zip || 'N/A'}
Phone: ${course.phone || 'N/A'}
Website: ${course.website || 'N/A'}

Tasks:
1. Fix capitalization and formatting
2. Standardize phone number format (###-###-####)
3. Ensure proper state abbreviations (2 letters, uppercase)
4. Clean up and validate zip codes (5 or 9 digits)
5. Validate and format website URLs (add https:// if missing)
6. Remove any duplicate information or typos
7. Ensure address is properly formatted

Provide JSON with cleaned fields:
{
  "name": "properly formatted name",
  "address": "cleaned address",
  "city": "properly capitalized city",
  "state": "XX",
  "zip": "cleaned zip",
  "phone": "###-###-#### or null",
  "website": "https://... or null",
  "changes_made": ["list of changes"]
}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a data cleaning expert. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const cleanedData = JSON.parse(aiData.choices[0].message.content);

    // Update course with cleaned data
    const { error: updateError } = await supabaseClient
      .from('golf_courses')
      .update({
        name: cleanedData.name,
        address: cleanedData.address,
        city: cleanedData.city,
        state: cleanedData.state,
        zip: cleanedData.zip,
        phone: cleanedData.phone,
        website: cleanedData.website,
      })
      .eq('id', courseId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        changes: cleanedData.changes_made 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error cleaning course data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
