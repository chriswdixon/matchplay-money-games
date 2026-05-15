import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) throw new Error('Invalid authentication');

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleData) throw new Error('Unauthorized: Admin access required');

    const apiKey = Deno.env.get('GOLFCOURSEAPI_KEY');
    if (!apiKey) throw new Error('Golf Course API key not configured');

    console.log('[IMPORT-GOLF-COURSES] Starting direct import by admin:', user.id);

    const PAGE_LIMIT = 100;
    const MAX_OFFSET = 50000;
    const THROTTLE_MS = 350;
    const MAX_RETRIES = 5;

    let offset = 0;
    let imported = 0;
    let failedBatches = 0;
    let totalFetched = 0;

    while (offset < MAX_OFFSET) {
      const url = `https://api.golfcourseapi.com/v1/courses?limit=${PAGE_LIMIT}&offset=${offset}`;
      let attempt = 0;
      let courses: any[] | null = null;

      while (attempt < MAX_RETRIES) {
        const res = await fetch(url, {
          headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
        });

        if (res.status === 429) {
          const backoff = Math.min(2000 * Math.pow(2, attempt), 15000);
          console.warn(`[IMPORT-GOLF-COURSES] 429 at offset=${offset}, backoff ${backoff}ms`);
          await sleep(backoff);
          attempt++;
          continue;
        }

        if (!res.ok) {
          throw new Error(`Golf API error ${res.status} at offset=${offset}`);
        }

        const data = await res.json();
        courses = Array.isArray(data?.courses) ? data.courses : [];
        break;
      }

      if (courses === null) {
        console.error(`[IMPORT-GOLF-COURSES] Giving up at offset=${offset} after ${MAX_RETRIES} retries`);
        failedBatches++;
        break;
      }

      const fetched = courses.length;
      totalFetched += fetched;
      console.log(`[IMPORT-GOLF-COURSES] offset=${offset} fetched=${fetched}`);

      if (fetched === 0) break;

      const rows = courses
        .filter((c) => c && c.name)
        .map((c) => ({
          external_id: c.id != null ? String(c.id) : null,
          name: c.name,
          address: c.address ?? null,
          city: c.city ?? null,
          state: c.state ?? null,
          zip: c.zip ?? null,
          country: c.country ?? null,
          latitude: c.latitude != null ? Number(c.latitude) : null,
          longitude: c.longitude != null ? Number(c.longitude) : null,
          phone: c.phone ?? null,
          website: c.website ?? null,
        }))
        .filter((r) => r.external_id);

      if (rows.length > 0) {
        const { error } = await supabase
          .from('golf_courses')
          .upsert(rows, { onConflict: 'external_id', ignoreDuplicates: false });

        if (error) {
          console.error(`[IMPORT-GOLF-COURSES] Upsert error at offset=${offset}:`, error);
          failedBatches++;
        } else {
          imported += rows.length;
        }
      }

      // Advance by the actual number of records returned
      offset += fetched;

      // If the API returned fewer than the requested page size, we're done
      if (fetched < PAGE_LIMIT) break;

      await sleep(THROTTLE_MS);
    }

    console.log(`[IMPORT-GOLF-COURSES] Done. fetched=${totalFetched} imported=${imported} failedBatches=${failedBatches}`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        total: totalFetched,
        failedBatches,
        message: `Imported/updated ${imported} of ${totalFetched} fetched courses${failedBatches ? ` (${failedBatches} failed batches)` : ''}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('[IMPORT-GOLF-COURSES] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unable to import golf courses.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
