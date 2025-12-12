import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EXPORT-USER-DATA] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error("Unauthorized");
    
    logStep("User authenticated", { userId: user.id });

    // Collect all user data
    const exportData: Record<string, unknown> = {
      export_date: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
    };

    // Profile data
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    exportData.profile = profile;

    // Private profile data
    const { data: privateProfile } = await supabaseClient
      .from('private_profile_data')
      .select('*')
      .eq('user_id', user.id)
      .single();
    exportData.private_profile = privateProfile;

    // Account balance
    const { data: account } = await supabaseClient
      .from('player_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single();
    exportData.account = account;

    // Transaction history
    const { data: transactions } = await supabaseClient
      .from('account_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    exportData.transactions = transactions;

    // Match participation history
    const { data: participations } = await supabaseClient
      .from('match_participants')
      .select(`
        *,
        match:matches(
          id,
          course_name,
          location,
          scheduled_time,
          format,
          buy_in_amount,
          status
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });
    exportData.match_participations = participations;

    // Match scores
    const { data: scores } = await supabaseClient
      .from('match_scores')
      .select('*')
      .eq('player_id', user.id)
      .order('created_at', { ascending: false });
    exportData.scores = scores;

    // Player ratings given
    const { data: ratingsGiven } = await supabaseClient
      .from('player_ratings')
      .select('*')
      .eq('rater_id', user.id);
    exportData.ratings_given = ratingsGiven;

    // Player ratings received
    const { data: ratingsReceived } = await supabaseClient
      .from('player_ratings')
      .select('*')
      .eq('rated_player_id', user.id);
    exportData.ratings_received = ratingsReceived;

    // Favorite courses
    const { data: favoriteCourses } = await supabaseClient
      .from('favorite_courses')
      .select('*')
      .eq('user_id', user.id);
    exportData.favorite_courses = favoriteCourses;

    // Consent records
    const { data: consents } = await supabaseClient
      .from('consent_records')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    exportData.consent_records = consents;

    // Matches created
    const { data: matchesCreated } = await supabaseClient
      .from('matches')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    exportData.matches_created = matchesCreated;

    logStep("Data export completed", { 
      profile: !!profile,
      transactions: transactions?.length || 0,
      matches: participations?.length || 0,
      scores: scores?.length || 0
    });

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="matchplay-data-export-${new Date().toISOString().split('T')[0]}.json"`
      },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
