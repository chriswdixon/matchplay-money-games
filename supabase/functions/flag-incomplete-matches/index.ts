import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { writeAudit } from '../_shared/audit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting incomplete match flagging process...');

    // Call the database function to flag incomplete matches
    const { data, error } = await supabase.rpc('flag_incomplete_matches');

    if (error) {
      console.error('Error flagging incomplete matches:', error);
      throw error;
    }

    const flaggedCount = data as number;
    console.log(`Successfully flagged ${flaggedCount} incomplete matches`);

    if (flaggedCount > 0) {
      await writeAudit(supabase, {
        category: 'admin_override',
        event_type: 'incomplete_matches.flagged',
        summary: `Flagged ${flaggedCount} incomplete match(es) for admin review`,
        payload: { flagged_count: flaggedCount, source: 'flag-incomplete-matches' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        flagged_count: flaggedCount,
        message: `Flagged ${flaggedCount} incomplete matches for admin review`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Fatal error in flag-incomplete-matches:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
