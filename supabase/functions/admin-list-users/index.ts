import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('Authentication failed');

    console.log('Fetching users for admin:', user.id);

    // Verify admin role
    const { data: adminRole, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !adminRole) {
      throw new Error('Access denied: Admin role required');
    }

    console.log('Admin role verified');

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('user_id, display_name, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) throw profilesError;

    console.log(`Found ${profiles?.length || 0} profiles`);

    // Fetch additional data for each user
    const usersWithDetails = await Promise.all(
      (profiles || []).map(async (profile) => {
        // Get email from auth.users
        const { data: authUser } = await supabaseClient.auth.admin.getUserById(profile.user_id);
        
        // Get phone and membership from private_profile_data
        const { data: privateData } = await supabaseClient
          .from('private_profile_data')
          .select('phone, membership_tier')
          .eq('user_id', profile.user_id)
          .maybeSingle();

        // Check if user is admin
        const { data: userRole } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.user_id)
          .eq('role', 'admin')
          .maybeSingle();

        return {
          user_id: profile.user_id,
          display_name: profile.display_name || 'Unknown',
          email: authUser?.user?.email || 'N/A',
          phone: privateData?.phone || null,
          membership_tier: privateData?.membership_tier || 'Free',
          is_admin: !!userRole,
          created_at: profile.created_at
        };
      })
    );

    console.log('Successfully fetched all user details');

    return new Response(
      JSON.stringify({ users: usersWithDetails }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in admin-list-users:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});