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
    const prompt = `Analyze this golf course and provide enriched data:
Name: ${sanitize(course.name)}
Address: ${sanitize(course.address)}, ${sanitize(course.city)}, ${sanitize(course.state)} ${sanitize(course.zip)}
${course.phone ? `Phone: ${sanitize(course.phone)}` : ''}
${course.website ? `Website: ${sanitize(course.website)}` : ''}

Provide a JSON response with:
1. description (2-3 sentences about the course)
2. amenities (array of available amenities like "Pro Shop", "Driving Range", "Restaurant", etc.)
3. difficulty_level (one of: "Beginner", "Intermediate", "Advanced", "Championship")
4. course_style (one of: "Links", "Parkland", "Desert", "Mountain", "Resort", "Municipal")
5. ai_rating (number 1-10 based on available information and reputation)
6. features (array of notable features like "Water Hazards", "Bunkers", "Tree-Lined", "Elevation Changes")
7. search_keywords (comma-separated keywords for better search)

Base your analysis on the course name, location, and any context clues. Be realistic and conservative with ratings if information is limited.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a golf course expert. Always respond with valid JSON only, no markdown or extra text.' },
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
    const enrichedData = JSON.parse(aiData.choices[0].message.content);

    // Update course with enriched data
    const { error: updateError } = await supabaseClient
      .from('golf_courses')
      .update({
        description: enrichedData.description,
        amenities: enrichedData.amenities,
        difficulty_level: enrichedData.difficulty_level,
        course_style: enrichedData.course_style,
        ai_rating: enrichedData.ai_rating,
        features: enrichedData.features,
        search_keywords: enrichedData.search_keywords,
        ai_enriched: true,
      })
      .eq('id', courseId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, data: enrichedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error enriching course:', error);
    
    // Return generic error messages
    const errorMap: Record<string, string> = {
      'Rate limit exceeded': 'Too many requests. Please try again later.',
      'AI credits depleted': 'Service temporarily unavailable.',
      'Invalid course ID': 'Invalid course ID provided.',
      'Authentication required': 'Authentication required.',
      'Unauthorized': 'Unauthorized access.',
      'Admin access required': 'Admin access required.'
    };
    
    const userMessage = errorMap[error.message] || 'Unable to enrich course data';
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
