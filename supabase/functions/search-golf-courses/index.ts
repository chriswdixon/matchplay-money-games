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
    // Search by name
    osmUrl = `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(name)}+golf+course&` +
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
