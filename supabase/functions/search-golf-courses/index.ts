import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const apiKey = Deno.env.get('GOLFCOURSEAPI_KEY');
    
    if (!apiKey) {
      console.error('[SEARCH-GOLF-COURSES] API key not configured');
      throw new Error('Golf Course API key not configured');
    }

    const { type, lat, lon, radius, name, limit } = await req.json();
    console.log('[SEARCH-GOLF-COURSES] Request:', { type, lat, lon, radius, name, limit });

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
    const courses: GolfCourse[] = (data.courses || []).map((course: GolfCourseAPIResponse) => {
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

    // Sort by distance if it's a nearby search
    if (type === 'nearby') {
      courses.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }

    console.log('[SEARCH-GOLF-COURSES] Returning', courses.length, 'courses');

    return new Response(
      JSON.stringify({ courses }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('[SEARCH-GOLF-COURSES] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        courses: [] // Return empty array as fallback
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 so frontend can handle gracefully
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
