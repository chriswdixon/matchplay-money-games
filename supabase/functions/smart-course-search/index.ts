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
    const { query, userLat, userLon } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Use AI to parse natural language query
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const prompt = `Parse this golf course search query and extract structured search criteria:
"${query}"

${userLat && userLon ? `User location: ${userLat}, ${userLon}` : ''}

Provide JSON with:
1. keywords (array of search terms)
2. difficulty_level (if mentioned: "Beginner", "Intermediate", "Advanced", "Championship", or null)
3. course_style (if mentioned: "Links", "Parkland", "Desert", "Mountain", "Resort", "Municipal", or null)
4. features (array of requested features like "Water Hazards", "Driving Range", etc.)
5. max_distance_miles (number if distance mentioned, or null)
6. min_rating (number 1-10 if quality mentioned, or null)

Examples:
- "challenging courses near me" → {"keywords": ["challenging"], "difficulty_level": "Advanced", "max_distance_miles": 25}
- "beginner friendly golf courses with driving range" → {"keywords": ["beginner", "friendly"], "difficulty_level": "Beginner", "features": ["Driving Range"]}
- "top rated desert courses" → {"keywords": ["top", "rated"], "course_style": "Desert", "min_rating": 7}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a search query parser. Always respond with valid JSON only.' },
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
    const searchCriteria = JSON.parse(aiData.choices[0].message.content);

    // Build database query
    let dbQuery = supabaseClient
      .from('golf_courses')
      .select('*');

    // Apply filters
    if (searchCriteria.difficulty_level) {
      dbQuery = dbQuery.eq('difficulty_level', searchCriteria.difficulty_level);
    }

    if (searchCriteria.course_style) {
      dbQuery = dbQuery.eq('course_style', searchCriteria.course_style);
    }

    if (searchCriteria.min_rating) {
      dbQuery = dbQuery.gte('ai_rating', searchCriteria.min_rating);
    }

    // Text search on keywords
    if (searchCriteria.keywords && searchCriteria.keywords.length > 0) {
      const keywordSearch = searchCriteria.keywords.join(' | ');
      dbQuery = dbQuery.or(`name.ilike.%${keywordSearch}%,search_keywords.ilike.%${keywordSearch}%`);
    }

    const { data: courses, error } = await dbQuery.limit(20);

    if (error) throw error;

    // Calculate distances and filter if needed
    let results = courses || [];
    if (userLat && userLon) {
      results = results.map(course => {
        if (course.latitude && course.longitude) {
          const distance = calculateDistance(
            userLat, userLon,
            Number(course.latitude), Number(course.longitude)
          );
          return { ...course, distance };
        }
        return course;
      });

      if (searchCriteria.max_distance_miles) {
        results = results.filter(c => c.distance && c.distance <= searchCriteria.max_distance_miles);
      }

      results.sort((a, b) => (a.distance || 999) - (b.distance || 999));
    }

    return new Response(
      JSON.stringify({ 
        courses: results,
        searchCriteria 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in smart search:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
