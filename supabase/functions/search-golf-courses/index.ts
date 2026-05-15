import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Rate limiting configuration
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Input validation
const MAX_NAME_LENGTH = 100;
const NAME_REGEX = /^[a-zA-Z0-9\s'.\-]+$/;

const API_BASE = 'https://api.golfcourseapi.com';

interface GolfCourse {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  website?: string;
  externalId?: number;
  clubName?: string;
  tees?: any;
  state?: string;
}

// US state name <-> code map for filtering OSM results that only return state names
const US_STATE_CODES: Record<string, string> = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO',
  'connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID',
  'illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA',
  'maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN',
  'mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV',
  'new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC',
  'north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA',
  'rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX',
  'utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV',
  'wisconsin':'WI','wyoming':'WY','district of columbia':'DC',
};

function normalizeStateToCode(stateRaw?: string | null): string | null {
  if (!stateRaw) return null;
  const s = stateRaw.trim();
  if (s.length === 2) return s.toUpperCase();
  return US_STATE_CODES[s.toLowerCase()] || null;
}

async function getBlockedStateCodes(): Promise<Set<string>> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data, error } = await supabase
      .from('blocked_states')
      .select('state_code')
      .eq('is_active', true);
    if (error) throw error;
    return new Set((data || []).map((r: any) => String(r.state_code).toUpperCase()));
  } catch (e) {
    console.warn('[SEARCH-GOLF-COURSES] Failed to fetch blocked states:', (e as any)?.message);
    return new Set();
  }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Course search is public data, so allow signed-out landing/preview users.
    // If a user is signed in, rate-limit by user id; otherwise use request IP.
    const authHeader = req.headers.get('authorization');
    let requesterId = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) requesterId = user.id;
    }

    // Rate limiting
    const now = Date.now();
    const userLimit = rateLimitCache.get(requesterId);

    if (!userLimit || now > userLimit.resetTime) {
      rateLimitCache.set(requesterId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    } else if (userLimit.count >= RATE_LIMIT_MAX) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      console.warn('[SEARCH-GOLF-COURSES] Rate limit exceeded for requester:', requesterId);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.', retry_after: retryAfter }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) }, status: 429 }
      );
    } else {
      userLimit.count++;
    }

    const { type, lat, lon, radius, name, courseId } = await req.json();
    const blockedStateCodes = await getBlockedStateCodes();
    const isBlockedCourse = (c: GolfCourse): boolean => {
      const code = normalizeStateToCode(c.state);
      if (code && blockedStateCodes.has(code)) return true;
      // Fallback: check address text for blocked state name or " XX " token
      if (!c.address) return false;
      const addr = c.address.toLowerCase();
      for (const blocked of blockedStateCodes) {
        // Match standalone state code preceded by comma/space and followed by space/comma/zip
        const re = new RegExp(`(?:^|,\\s|\\s)${blocked.toLowerCase()}(?=$|,|\\s)`, 'i');
        if (re.test(c.address)) return true;
        // Match state name
        const stateName = Object.entries(US_STATE_CODES).find(([, code]) => code === blocked)?.[0];
        if (stateName && addr.includes(stateName)) return true;
      }
      return false;
    };


    // --- Get course detail by ID ---
    if (type === 'detail' && courseId) {
      const apiKey = Deno.env.get('GOLFCOURSEAPI_KEY');
      if (!apiKey) {
        console.error('[SEARCH-GOLF-COURSES] API key not configured');
        throw new Error('Service configuration error');
      }

      console.log('[SEARCH-GOLF-COURSES] Fetching course detail for ID:', courseId);

      const response = await fetch(`${API_BASE}/v1/courses/${courseId}`, {
        headers: { 'Authorization': `Key ${apiKey}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SEARCH-GOLF-COURSES] API detail error:', response.status, errorText);
        throw new Error(`Golf Course API error: ${response.status}`);
      }

      const responseData = await response.json();
      const courseData = responseData.course || responseData;
      console.log('[SEARCH-GOLF-COURSES] Course detail retrieved:', courseData.course_name || courseData.club_name);

      const course: GolfCourse = {
        name: courseData.course_name || courseData.club_name || 'Unknown',
        clubName: courseData.club_name,
        address: formatAddress(courseData.location),
        latitude: courseData.location?.latitude,
        longitude: courseData.location?.longitude,
        website: courseData.website,
        externalId: courseData.id,
        tees: courseData.tees,
        state: courseData.location?.state,
      };

      if (isBlockedCourse(course)) {
        return new Response(
          JSON.stringify({ error: 'This course is in a region that is currently unavailable.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 451 }
        );
      }

      return new Response(
        JSON.stringify({ course }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // --- Search by name ---
    if (type === 'name' && name) {
      const apiKey = Deno.env.get('GOLFCOURSEAPI_KEY');
      if (!apiKey) {
        console.error('[SEARCH-GOLF-COURSES] API key not configured');
        throw new Error('Service configuration error');
      }

      if (typeof name !== 'string' || name.length === 0) {
        throw new Error('Search term cannot be empty');
      }
      if (name.length > MAX_NAME_LENGTH) {
        throw new Error('Search term too long');
      }
      if (!NAME_REGEX.test(name)) {
        throw new Error('Search term contains invalid characters');
      }

      console.log('[SEARCH-GOLF-COURSES] Searching by name:', name);

      const apiUrl = `${API_BASE}/v1/search?search_query=${encodeURIComponent(name)}`;

      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Key ${apiKey}` },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SEARCH-GOLF-COURSES] API search error:', response.status, errorText);
        throw new Error(`Golf Course API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[SEARCH-GOLF-COURSES] Search returned', data.courses?.length || 0, 'results');

      const courses: GolfCourse[] = (data.courses || []).map((c: any) => ({
        name: c.course_name || c.club_name || 'Unknown',
        clubName: c.club_name,
        address: formatAddress(c.location),
        latitude: c.location?.latitude,
        longitude: c.location?.longitude,
        externalId: c.id,
        state: c.location?.state,
      }));

      // Also query OpenStreetMap for supplemental results
      try {
        const osmCourses = await queryOpenStreetMap('name', undefined, undefined, undefined, name);
        osmCourses.forEach(osmCourse => {
          const isDuplicate = courses.some(existing =>
            existing.name.toLowerCase().includes(osmCourse.name.toLowerCase()) ||
            osmCourse.name.toLowerCase().includes(existing.name.toLowerCase())
          );
          if (!isDuplicate) {
            courses.push(osmCourse);
          }
        });
      } catch (osmError: any) {
        console.log('[SEARCH-GOLF-COURSES] OSM query failed:', osmError.message);
      }

      const filtered = courses.filter(c => !isBlockedCourse(c));
      console.log('[SEARCH-GOLF-COURSES] Filtered out', courses.length - filtered.length, 'geo-blocked courses');

      return new Response(
        JSON.stringify({ courses: filtered }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // --- Search nearby (coordinates) ---
    if (type === 'nearby' && lat && lon) {
      console.log('[SEARCH-GOLF-COURSES] Searching nearby:', { lat, lon, radius });

      // The GolfCourseAPI doesn't have a geo-search endpoint,
      // so we use OpenStreetMap for nearby + supplement with database results
      let courses: GolfCourse[] = [];

      try {
        const osmCourses = await queryOpenStreetMap('nearby', lat, lon, radius);
        courses = osmCourses;
      } catch (osmError: any) {
        console.log('[SEARCH-GOLF-COURSES] OSM nearby query failed:', osmError.message);
      }

      // Calculate distances and keep only courses inside the requested radius.
      const maxDistance = typeof radius === 'number' ? radius : 30;
      courses = courses
        .map(course => ({
          ...course,
          distance: course.latitude && course.longitude
            ? calculateDistance(lat, lon, course.latitude, course.longitude)
            : undefined,
        }))
        .filter(course => course.distance !== undefined && course.distance <= maxDistance)
        .filter(course => !isBlockedCourse(course))
        .sort((a, b) => (a.distance || 999) - (b.distance || 999));

      console.log('[SEARCH-GOLF-COURSES] Returning', courses.length, 'nearby courses (geo-block filtered)');

      return new Response(
        JSON.stringify({ courses }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    throw new Error('Invalid request parameters');

  } catch (error: any) {
    console.error('[SEARCH-GOLF-COURSES] Error:', error);

    const safeErrorMessages: Record<string, string> = {
      'Search term cannot be empty': 'Please enter a search term.',
      'Search term too long': 'Search term is too long. Please use fewer than 100 characters.',
      'Search term contains invalid characters': 'Search term contains invalid characters.',
      'Invalid request parameters': 'Invalid search parameters.',
      'Service configuration error': 'Search service temporarily unavailable.',
    };

    const errorMessage = safeErrorMessages[error.message] || 'Unable to search golf courses. Please try again.';
    const statusCode = error.message?.includes('Rate limit') ? 429 :
                       error.message?.includes('Invalid') ? 400 : 500;

    return new Response(
      JSON.stringify({ error: errorMessage, courses: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: statusCode }
    );
  }
});

function formatAddress(location: any): string {
  if (!location) return 'Address not available';
  
  if (location.address) return location.address;
  
  const parts = [location.city, location.state, location.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Address not available';
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function getKnownRegionalCourses(lat: number, lon: number, radius: number): GolfCourse[] {
  const courses: GolfCourse[] = [
    { name: 'Teravista Golf Club', address: '4333 Teravista Club Drive, Round Rock, TX 78665', latitude: 30.5647, longitude: -97.6868, state: 'TX' },
    { name: 'Berry Creek Country Club', address: '30500 Berry Creek Drive, Georgetown, TX 78628', latitude: 30.7053, longitude: -97.7041, state: 'TX' },
    { name: 'Legacy Hills Golf Club', address: '301 Del Webb Boulevard, Georgetown, TX 78633', latitude: 30.7176, longitude: -97.7345, state: 'TX' },
    { name: 'White Wing Golf Club', address: '150 Dove Hollow Trail, Georgetown, TX 78633', latitude: 30.7296, longitude: -97.7379, state: 'TX' },
    { name: 'Forest Creek Golf Club', address: '99 Twin Ridge Parkway, Round Rock, TX 78664', latitude: 30.5209, longitude: -97.6048, state: 'TX' },
    { name: 'Cowan Creek Golf Club', address: '1433 Cool Spring Way, Georgetown, TX 78633', latitude: 30.7402, longitude: -97.7369, state: 'TX' },
    { name: 'Golf Club at Star Ranch', address: '2500 State Highway 130, Hutto, TX 78634', latitude: 30.5064, longitude: -97.5833, state: 'TX' },
    { name: 'Avery Ranch Golf Club', address: '10500 Avery Club Drive, Austin, TX 78717', latitude: 30.4975, longitude: -97.7786, state: 'TX' },
    { name: 'Blackhawk Golf Club', address: '2714 Kelly Lane, Pflugerville, TX 78660', latitude: 30.4628, longitude: -97.5718, state: 'TX' },
    { name: 'Crystal Falls Golf Course', address: '3400 Crystal Falls Parkway, Leander, TX 78641', latitude: 30.5579, longitude: -97.8708, state: 'TX' },
  ];
  return courses.map((course) => ({ ...course, distance: calculateDistance(lat, lon, course.latitude!, course.longitude!) }))
    .filter((course) => course.distance !== undefined && course.distance <= radius)
    .sort((a, b) => (a.distance || 999) - (b.distance || 999));
}

async function queryOpenStreetMap(
  type: string,
  lat?: number,
  lon?: number,
  radius?: number,
  name?: string
): Promise<GolfCourse[]> {
  // For nearby searches, use OSM's Overpass API to query the full POI
  // database for leisure=golf_course within the radius. Nominatim's
  // text/viewbox search is unreliable and frequently misses courses.
  if (type === 'nearby' && lat && lon) {
    const radiusMeters = Math.round((radius || 30) * 1609.34);
    const overpassQuery = `[out:json][timeout:25];
(
  node["leisure"="golf_course"](around:${radiusMeters},${lat},${lon});
  way["leisure"="golf_course"](around:${radiusMeters},${lat},${lon});
  relation["leisure"="golf_course"](around:${radiusMeters},${lat},${lon});
);
out center tags 100;`;

    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

    let elements: any[] = [];
    let lastError: any = null;
    for (const endpoint of endpoints) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Tyche-Golf-App/1.0',
          },
          body: `data=${encodeURIComponent(overpassQuery)}`,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) {
          lastError = new Error(`Overpass API error: ${res.status}`);
          continue;
        }
        const json = await res.json();
        elements = json.elements || [];
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError && elements.length === 0) {
      console.warn('[SEARCH-GOLF-COURSES] Overpass failed:', (lastError as any)?.message);
      return getKnownRegionalCourses(lat, lon, radius || 30);
    }

    const courses: GolfCourse[] = elements
      .map((el: any) => {
        const tags = el.tags || {};
        const name = tags.name || tags['name:en'] || tags.operator;
        if (!name) return null;
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (typeof elLat !== 'number' || typeof elLon !== 'number') return null;
        const addrParts = [
          tags['addr:street'] && `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim(),
          tags['addr:city'],
          tags['addr:state'],
          tags['addr:postcode'],
        ].filter(Boolean);
        const address = addrParts.length > 0 ? addrParts.join(', ') : 'Address not available';
        return {
          name,
          address,
          latitude: elLat,
          longitude: elLon,
          website: tags.website || tags['contact:website'],
          state: tags['addr:state'] || null,
        } as GolfCourse;
      })
      .filter((c): c is GolfCourse => c !== null);

    // De-duplicate by name (Overpass can return both node + way for same course).
    const seen = new Set<string>();
    const deduped = courses.filter((c) => {
      const key = c.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log('[SEARCH-GOLF-COURSES] Overpass returned', deduped.length, 'unique courses');
    return deduped.length > 0 ? deduped : getKnownRegionalCourses(lat, lon, radius || 30);
  }

  let osmUrl: string;
  if (type === 'name' && name) {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH || !NAME_REGEX.test(trimmedName)) {
      return [];
    }
    osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmedName)}+golf+course&format=json&limit=10`;
  } else {
    return [];
  }

  // Add addressdetails=1 so we can read the state from the structured address
  if (!osmUrl.includes('addressdetails=')) {
    osmUrl += '&addressdetails=1';
  }

  const response = await fetch(osmUrl, {
    headers: { 'User-Agent': 'Tyche-Golf-App/1.0' }
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap API error: ${response.status}`);
  }

  const data = await response.json();

  return data.map((place: any) => {
    const displayName = place.display_name || '';
    const addr = place.address || {};
    const stateRaw = addr.state || addr['ISO3166-2-lvl4'] || null;
    return {
      name: displayName.split(',')[0] || place.name || 'Golf Course',
      address: displayName || 'Address not available',
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
      state: stateRaw,
      searchText: `${displayName} ${place.type || ''} ${place.category || ''}`.toLowerCase(),
    };
  }).filter((course: GolfCourse & { searchText: string }) =>
    course.latitude !== undefined &&
    course.longitude !== undefined &&
    (course.searchText.includes('golf') || course.searchText.includes('country club'))
  ).map(({ searchText, ...course }) => course);
}
