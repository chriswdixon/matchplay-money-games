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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authenticated user for rate limiting
    const authHeader = req.headers.get('authorization');
    let userId = 'anonymous';

    if (authHeader) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (user) userId = user.id;
    }

    // Rate limiting
    const now = Date.now();
    const userLimit = rateLimitCache.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      rateLimitCache.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    } else if (userLimit.count >= RATE_LIMIT_MAX) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      console.warn('[SEARCH-GOLF-COURSES] Rate limit exceeded for user:', userId);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.', retry_after: retryAfter }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) }, status: 429 }
      );
    } else {
      userLimit.count++;
    }

    const apiKey = Deno.env.get('GOLFCOURSEAPI_KEY');
    if (!apiKey) {
      console.error('[SEARCH-GOLF-COURSES] API key not configured');
      throw new Error('Service configuration error');
    }

    const { type, lat, lon, radius, name, courseId } = await req.json();

    // --- Get course detail by ID ---
    if (type === 'detail' && courseId) {
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
      };

      return new Response(
        JSON.stringify({ course }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // --- Search by name ---
    if (type === 'name' && name) {
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
      } catch (osmError) {
        console.log('[SEARCH-GOLF-COURSES] OSM query failed:', osmError.message);
      }

      return new Response(
        JSON.stringify({ courses }),
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
      } catch (osmError) {
        console.log('[SEARCH-GOLF-COURSES] OSM nearby query failed:', osmError.message);
      }

      // Calculate distances
      courses.forEach(course => {
        if (course.latitude && course.longitude) {
          course.distance = calculateDistance(lat, lon, course.latitude, course.longitude);
        }
      });

      courses.sort((a, b) => (a.distance || 999) - (b.distance || 999));

      console.log('[SEARCH-GOLF-COURSES] Returning', courses.length, 'nearby courses');

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

async function queryOpenStreetMap(
  type: string,
  lat?: number,
  lon?: number,
  radius?: number,
  name?: string
): Promise<GolfCourse[]> {
  let osmUrl: string;

  if (type === 'nearby' && lat && lon) {
    const radiusDegrees = (radius || 30) / 69;
    const south = lat - radiusDegrees;
    const west = lon - radiusDegrees;
    const north = lat + radiusDegrees;
    const east = lon + radiusDegrees;
    osmUrl = `https://nominatim.openstreetmap.org/search?q=golf+course&viewbox=${west},${south},${east},${north}&bounded=1&format=json&limit=20`;
  } else if (type === 'name' && name) {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH || !NAME_REGEX.test(trimmedName)) {
      return [];
    }
    osmUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmedName)}+golf+course&format=json&limit=10`;
  } else {
    return [];
  }

  const response = await fetch(osmUrl, {
    headers: { 'User-Agent': 'MatchPlay-Golf-App/1.0' }
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap API error: ${response.status}`);
  }

  const data = await response.json();

  return data.map((place: any) => ({
    name: place.display_name.split(',')[0] || place.name || 'Golf Course',
    address: place.display_name || 'Address not available',
    latitude: parseFloat(place.lat),
    longitude: parseFloat(place.lon),
  })).filter((course: GolfCourse) =>
    course.latitude !== undefined &&
    course.longitude !== undefined &&
    course.name.toLowerCase().includes('golf')
  );
}
