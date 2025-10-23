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
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { courseId } = await req.json();
    
    // Validate courseId
    if (!courseId || typeof courseId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid course ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get course data
    const { data: course, error: courseError } = await supabaseClient
      .from('golf_courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError) throw courseError;

    // Sanitize course data before embedding in prompt
    const sanitize = (str: string | null) => str ? String(str).substring(0, 200).replace(/[^\w\s,.-]/g, '') : 'N/A';

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const prompt = `Clean and standardize this golf course data:

Current Data:
Name: ${sanitize(course.name)}
Address: ${sanitize(course.address)}
City: ${sanitize(course.city)}
State: ${sanitize(course.state)}
Zip: ${sanitize(course.zip)}
Phone: ${sanitize(course.phone)}
Website: ${sanitize(course.website)}

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
    
    // Return generic error messages
    const errorMap: Record<string, string> = {
      'Rate limit exceeded': 'Too many requests. Please try again later.',
      'AI credits depleted': 'Service temporarily unavailable.',
      'Invalid course ID': 'Invalid course ID provided.',
      'Authentication required': 'Authentication required.',
      'Unauthorized': 'Unauthorized access.',
      'Admin access required': 'Admin access required.'
    };
    
    const userMessage = errorMap[error.message] || 'Unable to clean course data';
    const statusCode = error.message === 'Authentication required' || error.message === 'Unauthorized' ? 401 
                      : error.message === 'Admin access required' ? 403
                      : error.message === 'Invalid course ID' ? 400
                      : 500;
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
