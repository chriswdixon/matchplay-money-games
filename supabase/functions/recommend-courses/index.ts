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
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader! } } }
    );

    // Get user data
    const { data: { user } } = await supabaseClient.auth.getUser(token);
    if (!user) throw new Error('Not authenticated');

    const { userLat, userLon, limit = 5 } = await req.json();

    // Get user's profile and match history
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('handicap')
      .eq('user_id', user.id)
      .single();

    const { data: matchHistory } = await supabaseClient
      .from('match_participants')
      .select('match_id, matches!inner(course_name, format)')
      .eq('user_id', user.id)
      .limit(10);

    const { data: favoriteCourses } = await supabaseClient
      .from('favorite_courses')
      .select('course_name')
      .eq('user_id', user.id);

    // Use AI to generate recommendations
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const prompt = `Generate personalized golf course recommendations for this user:

User Profile:
- Handicap: ${profile?.handicap || 'Not set'}
- Recent courses played: ${matchHistory?.map(m => m.matches.course_name).join(', ') || 'None'}
- Favorite courses: ${favoriteCourses?.map(c => c.course_name).join(', ') || 'None'}
- Match formats played: ${matchHistory?.map(m => m.matches.format).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'None'}

Based on this profile, suggest:
1. difficulty_preferences (array: "Beginner", "Intermediate", "Advanced", "Championship")
2. style_preferences (array: "Links", "Parkland", "Desert", "Mountain", "Resort", "Municipal")
3. feature_preferences (array of features they'd likely enjoy)
4. reasoning (brief explanation of recommendations)

Respond with JSON only.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a golf course recommendation expert. Always respond with valid JSON only.' },
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
    const preferences = JSON.parse(aiData.choices[0].message.content);

    // Find courses matching preferences
    let dbQuery = supabaseClient
      .from('golf_courses')
      .select('*')
      .eq('ai_enriched', true);

    if (preferences.difficulty_preferences?.length > 0) {
      dbQuery = dbQuery.in('difficulty_level', preferences.difficulty_preferences);
    }

    if (preferences.style_preferences?.length > 0) {
      dbQuery = dbQuery.in('course_style', preferences.style_preferences);
    }

    const { data: courses, error } = await dbQuery.gte('ai_rating', 6).limit(20);

    if (error) throw error;

    // Score and rank courses
    let scoredCourses = (courses || []).map(course => {
      let score = course.ai_rating || 0;

      // Boost score for matching features
      if (preferences.feature_preferences?.length > 0 && course.features) {
        const matchingFeatures = preferences.feature_preferences.filter(
          (f: string) => course.features.includes(f)
        );
        score += matchingFeatures.length * 0.5;
      }

      // Add distance consideration
      if (userLat && userLon && course.latitude && course.longitude) {
        const distance = calculateDistance(
          userLat, userLon,
          Number(course.latitude), Number(course.longitude)
        );
        course.distance = distance;
        // Prefer closer courses
        if (distance < 10) score += 2;
        else if (distance < 25) score += 1;
      }

      return { ...course, recommendation_score: score };
    });

    scoredCourses.sort((a, b) => b.recommendation_score - a.recommendation_score);
    scoredCourses = scoredCourses.slice(0, limit);

    return new Response(
      JSON.stringify({ 
        recommendations: scoredCourses,
        reasoning: preferences.reasoning 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959;
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
