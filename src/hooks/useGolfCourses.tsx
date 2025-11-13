import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface GolfCourse {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance?: number;
  website?: string;
  // AI-enhanced fields
  description?: string;
  amenities?: string[];
  difficulty_level?: string;
  course_style?: string;
  ai_rating?: number;
  features?: string[];
  ai_enriched?: boolean;
  search_keywords?: string;
}

export const useGolfCourses = () => {
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [allCourses, setAllCourses] = useState<GolfCourse[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const lastToastMessage = useRef<string>('');
  const toastTimestamp = useRef<number>(0);
  
  // Circuit breaker for API failures
  const apiFailureCount = useRef<number>(0);
  const apiBlockedUntil = useRef<number>(0);
  const MAX_API_FAILURES = 3;
  const API_BLOCK_DURATION = 60000; // 1 minute

  const showToastOnce = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
    const now = Date.now();
    // Prevent duplicate toasts within 3 seconds
    if (lastToastMessage.current === message && now - toastTimestamp.current < 3000) {
      return;
    }
    lastToastMessage.current = message;
    toastTimestamp.current = now;
    
    switch(type) {
      case 'success': toast.success(message); break;
      case 'warning': toast.warning(message); break;
      case 'error': toast.error(message); break;
      default: toast.info(message);
    }
  };

  const searchNearbyCourses = async (latitude: number, longitude: number, radius: number = 30) => {
    try {
      setLoading(true);
      console.log('🔍 Searching for golf courses near:', { latitude, longitude, radius });
      
      // First, query our database
      const { data: dbCourses, error: dbError } = await supabase
        .from('golf_courses')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (dbError) {
        console.error('❌ Database error:', dbError);
      }

      // Calculate distances for database courses
      const coursesWithDistance = (dbCourses || []).map(course => ({
        name: course.name,
        address: course.address || '',
        latitude: course.latitude!,
        longitude: course.longitude!,
        distance: calculateDistance(latitude, longitude, course.latitude!, course.longitude!),
        website: course.website || undefined,
      })).filter(course => course.distance <= radius)
        .sort((a, b) => a.distance - b.distance);

      console.log(`🏌️ Found ${coursesWithDistance.length} courses in database within ${radius} miles`);

      // If we have enough database results, use them
      if (coursesWithDistance.length >= 10) {
        setCourses(coursesWithDistance);
        setAllCourses(coursesWithDistance);
        showToastOnce(`Found ${coursesWithDistance.length} golf courses nearby`, 'success');
        return coursesWithDistance;
      }

      // Check circuit breaker before making API call
      const now = Date.now();
      const isApiBlocked = now < apiBlockedUntil.current;
      
      if (!isApiBlocked) {
        // Otherwise, supplement with API results
        console.log('🌐 Querying API for additional courses');
        
        try {
          const { data, error } = await supabase.functions.invoke('search-golf-courses', {
            body: { 
              type: 'nearby',
              lat: latitude,
              lon: longitude,
              radius: radius
            }
          });

          if (error) {
            console.error('❌ Edge function error:', error);
            apiFailureCount.current++;
            
            if (apiFailureCount.current >= MAX_API_FAILURES) {
              apiBlockedUntil.current = now + API_BLOCK_DURATION;
              console.warn('🚫 API circuit breaker activated. Blocking API calls for 1 minute.');
              showToastOnce('Golf course search temporarily unavailable. Using database results.', 'warning');
            }
            
            throw error;
          }
          
          // Reset failure count on success
          apiFailureCount.current = 0;

          const apiCourses: GolfCourse[] = data.courses || [];
          
          // Merge database and API results
          const allCourses: GolfCourse[] = [...coursesWithDistance];
          apiCourses.forEach((apiCourse: GolfCourse) => {
            if (!allCourses.some(c => c.name.toLowerCase() === apiCourse.name.toLowerCase())) {
              // Calculate distance for API courses
              const courseWithDistance: GolfCourse = {
                ...apiCourse,
                distance: apiCourse.distance || calculateDistance(latitude, longitude, apiCourse.latitude, apiCourse.longitude)
              };
              allCourses.push(courseWithDistance);
            }
          });

          // Add popular courses as final fallback
          const popularCourses = getPopularCourses(latitude, longitude);
          popularCourses.forEach(popular => {
            if (!allCourses.some(c => c.name.toLowerCase() === popular.name.toLowerCase())) {
              allCourses.push(popular);
            }
          });

          allCourses.sort((a, b) => (a.distance || 999) - (b.distance || 999));
          
          console.log('📋 Total courses:', allCourses.length);
          setCourses(allCourses);
          setAllCourses(allCourses);
          
          if (allCourses.length > 0) {
            showToastOnce(`Found ${allCourses.length} golf courses nearby`, 'success');
          } else {
            showToastOnce('No golf courses found nearby. Try entering a course name manually.', 'warning');
          }
          
          return allCourses;
        } catch (apiError) {
          console.error('❌ API call failed, using fallback:', apiError);
          // Fall through to use database + popular courses only
        }
      } else {
        console.log('⚠️ API circuit breaker active. Using database and popular courses only.');
      }
      
      // If API is blocked or failed, use database + popular courses
      const fallbackCourses: GolfCourse[] = [...coursesWithDistance];
      const popularCourses = getPopularCourses(latitude, longitude);
      popularCourses.forEach(popular => {
        if (!fallbackCourses.some(c => c.name.toLowerCase() === popular.name.toLowerCase())) {
          fallbackCourses.push(popular);
        }
      });
      
      fallbackCourses.sort((a, b) => (a.distance || 999) - (b.distance || 999));
      
      setCourses(fallbackCourses);
      setAllCourses(fallbackCourses);
      
      if (fallbackCourses.length > 0) {
        showToastOnce(`Found ${fallbackCourses.length} golf courses`, 'success');
      } else {
        showToastOnce('No golf courses found nearby. Try entering a course name manually.', 'warning');
      }
      
      return fallbackCourses;
    } catch (error: any) {
      console.error('❌ Error fetching golf courses:', error);
      
      // Fallback to popular courses
      const popularCourses = getPopularCourses(latitude, longitude);
      setCourses(popularCourses);
      setAllCourses(popularCourses);
      
      showToastOnce('Using popular courses. API unavailable.', 'info');
      
      return popularCourses;
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getPopularCourses = (latitude: number, longitude: number): GolfCourse[] => {
    // Expanded list of popular golf courses including regional chains and state-specific courses
    const popular = [
      // Famous Championship Courses
      { name: "Pebble Beach Golf Links", address: "1700 17-Mile Drive, Pebble Beach, CA", lat: 36.5694, lon: -121.9469, website: "https://www.pebblebeach.com" },
      { name: "Augusta National Golf Club", address: "2604 Washington Road, Augusta, GA", lat: 33.5028, lon: -82.0201, website: "https://www.google.com/search?q=Augusta+National+Golf+Club" },
      { name: "TPC Sawgrass", address: "110 Championship Way, Ponte Vedra Beach, FL", lat: 30.1958, lon: -81.3959, website: "https://www.tpc.com/sawgrass" },
      { name: "Bethpage Black Course", address: "99 Quaker Meeting House Rd, Farmingdale, NY", lat: 40.7456, lon: -73.4593, website: "https://www.nysparks.com/golf-courses/12/details.aspx" },
      { name: "Torrey Pines Golf Course", address: "11480 N Torrey Pines Rd, La Jolla, CA", lat: 32.8998, lon: -117.2573, website: "https://www.sandiego.gov/park-and-recreation/golf/torreypines" },
      { name: "Whistling Straits", address: "W12782 Whistling Straits Dr, Sheboygan, WI", lat: 43.6636, lon: -87.7981, website: "https://www.destinationkohler.com/golf/whistling-straits" },
      { name: "Pinehurst No. 2", address: "1 Carolina Vista Dr, Pinehurst, NC", lat: 35.1959, lon: -79.4678, website: "https://www.pinehurst.com" },
      { name: "Kiawah Island Ocean Course", address: "1000 Ocean Course Dr, Kiawah Island, SC", lat: 32.5732, lon: -80.0364, website: "https://www.kiawahresort.com/golf/ocean-course" },
      { name: "Chambers Bay", address: "6320 Grandview Dr W, University Place, WA", lat: 47.2089, lon: -122.5661, website: "https://www.chambersbay.com" },
      { name: "Oakmont Country Club", address: "1233 Hulton Rd, Oakmont, PA", lat: 40.5214, lon: -79.8431, website: "https://www.google.com/search?q=Oakmont+Country+Club" },
      { name: "Winged Foot Golf Club", address: "851 Fenimore Rd, Mamaroneck, NY", lat: 40.9506, lon: -73.7632, website: "https://www.google.com/search?q=Winged+Foot+Golf+Club" },
      { name: "Shinnecock Hills Golf Club", address: "200 Tuckahoe Rd, Southampton, NY", lat: 40.8922, lon: -72.4575, website: "https://www.google.com/search?q=Shinnecock+Hills" },
      
      // West Coast Regional
      { name: "Spyglass Hill Golf Course", address: "Spyglass Hill Rd, Pebble Beach, CA", lat: 36.5833, lon: -121.9500, website: "https://www.pebblebeach.com/golf/spyglass-hill-golf-course" },
      { name: "Spanish Bay Golf Links", address: "2700 17 Mile Dr, Pebble Beach, CA", lat: 36.6125, lon: -121.9325, website: "https://www.pebblebeach.com" },
      { name: "Poppy Hills Golf Course", address: "3200 Lopez Rd, Pebble Beach, CA", lat: 36.5889, lon: -121.9369, website: "https://www.poppyhillsgolf.com" },
      { name: "TPC Stadium Course", address: "80080 Avenue 52, La Quinta, CA", lat: 33.6603, lon: -116.2733, website: "https://www.tpc.com/stadium-course" },
      { name: "TPC Scottsdale", address: "17020 N Hayden Rd, Scottsdale, AZ", lat: 33.6131, lon: -111.9092, website: "https://www.tpc.com/scottsdale" },
      { name: "Grayhawk Golf Club", address: "8620 E Thompson Peak Pkwy, Scottsdale, AZ", lat: 33.6367, lon: -111.8947, website: "https://www.grayhawkgolf.com" },
      { name: "Troon North Golf Club", address: "10320 E Dynamite Blvd, Scottsdale, AZ", lat: 33.7106, lon: -111.8203, website: "https://www.troonnorthgolf.com" },
      
      // South Regional
      { name: "Harbour Town Golf Links", address: "11 Lighthouse Ln, Hilton Head, SC", lat: 32.1378, lon: -80.8064, website: "https://www.seapines.com/golf" },
      { name: "Sea Island Golf Club", address: "100 Retreat Ave, St Simons Island, GA", lat: 31.1256, lon: -81.3978, website: "https://www.seaisland.com/golf" },
      { name: "Streamsong Resort", address: "1000 Streamsong Dr, Bowling Green, FL", lat: 27.5781, lon: -81.7736, website: "https://www.streamsongresort.com" },
      { name: "TPC Louisiana", address: "11001 Lapalco Blvd, Avondale, LA", lat: 29.9008, lon: -90.2106, website: "https://www.tpc.com/louisiana" },
      
      // Midwest Regional
      { name: "Arcadia Bluffs Golf Club", address: "14710 Northwood Hwy, Arcadia, MI", lat: 44.4894, lon: -86.2256, website: "https://www.arcadiabluffs.com" },
      { name: "Erin Hills Golf Course", address: "7169 County Highway O, Erin, WI", lat: 43.2992, lon: -88.4289, website: "https://www.erinhills.com" },
      { name: "Cog Hill Golf Club", address: "12294 Archer Ave, Lemont, IL", lat: 41.6478, lon: -87.9731, website: "https://www.coghillgolf.com" },
      
      // Northeast Regional
      { name: "Trump National Golf Club", address: "339 Pine Rd, Briarcliff Manor, NY", lat: 41.1569, lon: -73.8458, website: "https://www.trumpgolf.com/westchester" },
      { name: "Baltusrol Golf Club", address: "201 Shunpike Rd, Springfield, NJ", lat: 40.7039, lon: -74.3203, website: "https://www.google.com/search?q=Baltusrol+Golf+Club" },
      { name: "Congressional Country Club", address: "8500 River Rd, Bethesda, MD", lat: 38.9833, lon: -77.1167, website: "https://www.google.com/search?q=Congressional+Country+Club" },
      
      // Texas Regional
      { name: "Colonial Country Club", address: "3735 Country Club Cir, Fort Worth, TX", lat: 32.7414, lon: -97.3731, website: "https://www.google.com/search?q=Colonial+Country+Club" },
      { name: "TPC San Antonio", address: "23808 Resort Pkwy, San Antonio, TX", lat: 29.6156, lon: -98.4772, website: "https://www.tpc.com/sanantonio" },
      { name: "Star Ranch Golf Club", address: "2500 FM 685, Hutto, TX", lat: 30.5064, lon: -97.5833, website: "https://www.starranchgolf.com" },
      { name: "Black Hawk Golf Course", address: "644 Blackhawk Rd, Beaver Falls, PA", lat: 40.7522, lon: -80.3387, website: "https://blackhawkgolfcourse.com" },
      
      // Mountain/Northwest
      { name: "Pumpkin Ridge Golf Club", address: "12930 NW Old Pumpkin Ridge Rd, North Plains, OR", lat: 45.6031, lon: -122.9792, website: "https://www.pumpkinridge.com" },
      { name: "The Broadmoor Golf Club", address: "1 Lake Ave, Colorado Springs, CO", lat: 38.7878, lon: -104.8594, website: "https://www.broadmoor.com/golf" },
      
      // Canadian Courses
      { name: "Cabot Cliffs", address: "147 Cabot Trail, Inverness, NS", lat: 46.2186, lon: -61.0925, website: "https://www.cabotlinks.com" },
      { name: "Banff Springs Golf Course", address: "405 Spray Ave, Banff, AB", lat: 51.1628, lon: -115.5619, website: "https://www.fairmont.com/banff-springs/golf" }
    ];

    return popular.map(course => ({
      name: course.name,
      address: course.address,
      latitude: course.lat,
      longitude: course.lon,
      distance: calculateDistance(latitude, longitude, course.lat, course.lon),
      website: course.website
    })).sort((a, b) => a.distance - b.distance);
  };

  const searchCoursesByName = async (searchTermInput: string): Promise<GolfCourse[]> => {
    setSearchTerm(searchTermInput);
    
    if (!searchTermInput || searchTermInput.length < 2) {
      const defaultCourses = allCourses.slice(0, 10);
      setCourses(defaultCourses);
      return defaultCourses;
    }
    
    setLoading(true);
    
    try {
      console.log('🔍 Comprehensive search for:', searchTermInput);
      
      // Step 1: Comprehensive database search across name, address, city, state
      const { data: exactMatches, error: exactError } = await supabase
        .from('golf_courses')
        .select('*')
        .or(`name.ilike.%${searchTermInput}%,address.ilike.%${searchTermInput}%,city.ilike.%${searchTermInput}%,state.ilike.%${searchTermInput}%,zip.ilike.%${searchTermInput}%`)
        .limit(50);

      if (exactError) {
        console.error('❌ Database search error:', exactError);
      }

      const dbResults = (exactMatches || []).map(course => ({
        name: course.name,
        address: course.address || '',
        latitude: course.latitude || 0,
        longitude: course.longitude || 0,
        website: course.website || undefined,
      })).filter(c => c.latitude && c.longitude);

      console.log(`🏌️ Found ${dbResults.length} courses in database (name + location search)`);

      // If we have good database results, use them but still query API for completeness
      if (dbResults.length >= 10) {
        setCourses(dbResults);
        return dbResults;
      }

      // Check circuit breaker before making API call
      const now = Date.now();
      const isApiBlocked = now < apiBlockedUntil.current;
      
      if (!isApiBlocked) {
        // Step 3: Query external API
        console.log('🌐 Querying external API for additional courses');
        
        try {
          const { data, error } = await supabase.functions.invoke('search-golf-courses', {
            body: { 
              type: 'name',
              name: searchTermInput,
              limit: 20
            }
          });

          if (error) {
            console.error('❌ Edge function error:', error);
            apiFailureCount.current++;
            
            if (apiFailureCount.current >= MAX_API_FAILURES) {
              apiBlockedUntil.current = now + API_BLOCK_DURATION;
              console.warn('🚫 API circuit breaker activated. Blocking API calls for 1 minute.');
            }
            
            throw error;
          }
          
          // Reset failure count on success
          apiFailureCount.current = 0;

          const apiCourses: GolfCourse[] = data.courses || [];
          
          // Merge database and API results
          const allResults: GolfCourse[] = [...dbResults];
          apiCourses.forEach((apiCourse: GolfCourse) => {
            if (!allResults.some(c => c.name.toLowerCase() === apiCourse.name.toLowerCase())) {
              allResults.push(apiCourse);
            }
          });

      // Also search local and popular courses for supplementary results
      const lowerSearchTerm = searchTermInput.toLowerCase();
      
      // Search in already loaded courses
      const localMatches = allCourses.filter(course =>
        course.name.toLowerCase().includes(lowerSearchTerm) ||
        course.address.toLowerCase().includes(lowerSearchTerm)
      );

      // Search popular courses
      const popularCourses = getPopularCourses(0, 0);
      const popularMatches = popularCourses.filter(course =>
        course.name.toLowerCase().includes(lowerSearchTerm) ||
        course.address.toLowerCase().includes(lowerSearchTerm)
      );

      // Add local matches that aren't duplicates
      localMatches.forEach(local => {
        if (!allResults.some(course => course.name.toLowerCase() === local.name.toLowerCase())) {
          allResults.push(local);
        }
      });

      // Add popular matches that aren't duplicates
      popularMatches.forEach(popular => {
        if (!allResults.some(course => course.name.toLowerCase() === popular.name.toLowerCase())) {
          allResults.push(popular);
        }
      });

      // Sort by relevance
      const sortedResults = allResults.sort((a, b) => {
        const aExactMatch = a.name.toLowerCase().startsWith(lowerSearchTerm);
        const bExactMatch = b.name.toLowerCase().startsWith(lowerSearchTerm);
        
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
        return a.name.localeCompare(b.name);
      }).slice(0, 20);

      console.log('📋 Total search results:', sortedResults.length);
      setCourses(sortedResults);
      return sortedResults;

    } catch (error) {
      console.error('❌ Error searching courses:', error);
      
      // Fallback to local search only
      const lowerSearchTerm = searchTermInput.toLowerCase();
      
      const localMatches = allCourses.filter(course =>
        course.name.toLowerCase().includes(lowerSearchTerm) ||
        course.address.toLowerCase().includes(lowerSearchTerm)
      );

      const popularCourses = getPopularCourses(0, 0);
      const popularMatches = popularCourses.filter(course =>
        course.name.toLowerCase().includes(lowerSearchTerm) ||
        course.address.toLowerCase().includes(lowerSearchTerm)
      );

      const fallbackResults = [...localMatches, ...popularMatches].slice(0, 20);
      setCourses(fallbackResults);
      return fallbackResults;

    } finally {
      setLoading(false);
    }
  };

  const formatDistance = (distanceMiles: number): string => {
    if (distanceMiles < 1) {
      return `${Math.round(distanceMiles * 5280)}ft`;
    } else if (distanceMiles < 10) {
      return `${distanceMiles.toFixed(1)}mi`;
    } else {
      return `${Math.round(distanceMiles)}mi`;
    }
  };

  return {
    courses,
    loading,
    searchNearbyCourses,
    searchCoursesByName,
    formatDistance
  };
};