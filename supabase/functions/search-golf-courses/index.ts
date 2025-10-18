import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 20; // searches per window
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Input validation limits
const MAX_NAME_LENGTH = 100;
const NAME_REGEX = /^[a-zA-Z0-9\s'.-]+$/;

interface GolfCourseAPIResponse {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
}

interface GolfCourse {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  website?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Rate limiting check
    const now = Date.now();
    const userLimit = rateLimitCache.get(userId);
    
    if (!userLimit || now > userLimit.resetTime) {
      rateLimitCache.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    } else if (userLimit.count >= RATE_LIMIT_MAX) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      console.warn('[SEARCH-GOLF-COURSES] Rate limit exceeded for user:', userId);
      return new Response(
        JSON.stringify({ 
          error: 'Too many requests. Please try again later.',
          retry_after: retryAfter
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
          status: 429
        }
      );
    } else {
      userLimit.count++;
    }

    const apiKey = Deno.env.get('GOLFCOURSEAPI_KEY');
    
    if (!apiKey) {
      console.error('[SEARCH-GOLF-COURSES] API key not configured');
      throw new Error('Service configuration error');
    }

    const { type, lat, lon, radius, name, limit } = await req.json();
    
    // Input validation for name searches
    if (type === 'name' && name) {
      if (typeof name !== 'string') {
        throw new Error('Invalid search term format');
      }
      if (name.length === 0) {
        throw new Error('Search term cannot be empty');
      }
      if (name.length > MAX_NAME_LENGTH) {
        throw new Error('Search term too long');
      }
      if (!NAME_REGEX.test(name)) {
        throw new Error('Search term contains invalid characters');
      }
    }
    
    console.log('[SEARCH-GOLF-COURSES] Request:', { type, lat, lon, radius, nameLength: name?.length });

    let apiUrl: string;
    
    if (type === 'nearby' && lat && lon) {
      // Search by coordinates - using the courses endpoint with location params
      const radiusMiles = radius || 30;
      apiUrl = `https://api.golfcourseapi.com/v1/courses?lat=${lat}&lon=${lon}&radius=${radiusMiles}`;
    } else if (type === 'name' && name) {
      // Search by name
      const searchLimit = limit || 10;
      apiUrl = `https://api.golfcourseapi.com/v1/courses?name=${encodeURIComponent(name)}&limit=${searchLimit}`;
    } else {
      throw new Error('Invalid request parameters');
    }

    console.log('[SEARCH-GOLF-COURSES] API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SEARCH-GOLF-COURSES] API error:', response.status, errorText);
      throw new Error(`Golf Course API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[SEARCH-GOLF-COURSES] API response:', data);

    // Map the API response to our GolfCourse format
    let courses: GolfCourse[] = (data.courses || []).map((course: GolfCourseAPIResponse) => {
      // Build address string
      const addressParts = [
        course.address,
        course.city,
        course.state,
        course.zip
      ].filter(Boolean);
      
      const mappedCourse: GolfCourse = {
        name: course.name,
        address: addressParts.join(', ') || 'Address not available',
        latitude: course.latitude,
        longitude: course.longitude,
        website: course.website,
      };

      // Calculate distance if we have coordinates
      if (type === 'nearby' && lat && lon && course.latitude && course.longitude) {
        mappedCourse.distance = calculateDistance(
          lat,
          lon,
          course.latitude,
          course.longitude
        );
      }

      return mappedCourse;
    });

    // Also query OpenStreetMap for additional open data
    try {
      console.log('[SEARCH-GOLF-COURSES] Querying OpenStreetMap...');
      const osmCourses = await queryOpenStreetMap(type, lat, lon, radius, name);
      console.log('[SEARCH-GOLF-COURSES] OpenStreetMap returned', osmCourses.length, 'courses');
      
      // Merge OSM results, avoiding duplicates
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
      console.log('[SEARCH-GOLF-COURSES] OpenStreetMap query failed:', osmError.message);
      // Continue without OSM data
    }

    // Sort by distance if it's a nearby search
    if (type === 'nearby') {
      courses.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    console.log('[SEARCH-GOLF-COURSES] Returning', courses.length, 'total courses');

    return new Response(
      JSON.stringify({ courses }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[SEARCH-GOLF-COURSES] Error:', error);
    
    // Map errors to safe user messages
    const safeErrorMessages: Record<string, string> = {
      'Invalid search term format': 'Invalid search term. Please try again.',
      'Search term cannot be empty': 'Please enter a search term.',
      'Search term too long': 'Search term is too long. Please use fewer than 100 characters.',
      'Search term contains invalid characters': 'Search term contains invalid characters. Please use only letters, numbers, spaces, apostrophes, periods, and hyphens.',
      'Invalid request parameters': 'Invalid search parameters.',
      'Service configuration error': 'Search service temporarily unavailable. Please try again later.',
    };
    
    const errorMessage = safeErrorMessages[error.message] || 'Unable to search golf courses. Please try again.';
    const statusCode = error.message?.includes('Rate limit') ? 429 : 
                       error.message?.includes('Invalid') ? 400 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        courses: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode
      }
    );
  }
});

// Calculate distance between two coordinates in miles using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Query OpenStreetMap Nominatim API for golf courses
async function queryOpenStreetMap(
  type: string,
  lat?: number,
  lon?: number,
  radius?: number,
  name?: string
): Promise<GolfCourse[]> {
  let osmUrl: string;
  
  if (type === 'nearby' && lat && lon) {
    // Search by coordinates using viewbox
    const radiusDegrees = (radius || 30) / 69; // Approximate miles to degrees
    const south = lat - radiusDegrees;
    const west = lon - radiusDegrees;
    const north = lat + radiusDegrees;
    const east = lon + radiusDegrees;
    
    osmUrl = `https://nominatim.openstreetmap.org/search?` +
      `q=golf+course&` +
      `viewbox=${west},${south},${east},${north}&` +
      `bounded=1&` +
      `format=json&` +
      `limit=20`;
  } else if (type === 'name' && name) {
    // Validate name input (already validated in main handler, but double-check)
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > MAX_NAME_LENGTH || !NAME_REGEX.test(trimmedName)) {
      console.warn('[SEARCH-GOLF-COURSES] Invalid OSM query input, skipping OSM search');
      return [];
    }
    
    // Search by name
    osmUrl = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(trimmedName)}+golf+course&` +
      `format=json&` +
      `limit=10`;
  } else {
    return [];
  }

  const response = await fetch(osmUrl, {
    headers: {
      'User-Agent': 'MatchPlay-Golf-App/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`OpenStreetMap API error: ${response.status}`);
  }

  const data = await response.json();
  
  return data.map((place: any) => {
    const course: GolfCourse = {
      name: place.display_name.split(',')[0] || place.name || 'Golf Course',
      address: place.display_name || 'Address not available',
      latitude: parseFloat(place.lat),
      longitude: parseFloat(place.lon),
    };

    // Calculate distance for nearby searches
    if (type === 'nearby' && lat && lon) {
      course.distance = calculateDistance(lat, lon, course.latitude!, course.longitude!);
    }

    return course;
  }).filter((course: GolfCourse) => 
    course.latitude !== undefined && 
    course.longitude !== undefined &&
    course.name.toLowerCase().includes('golf')
  );
}
