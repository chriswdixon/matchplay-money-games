import { useState } from 'react';
import { toast } from 'sonner';

export interface GolfCourse {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance?: number;
}

export const useGolfCourses = () => {
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [loading, setLoading] = useState(false);

  const searchNearbyCourses = async (latitude: number, longitude: number, radius: number = 15) => {
    try {
      setLoading(true);
      
      // Using Overpass API to find golf courses near the location
      const overpassQuery = `
        [out:json][timeout:25];
        (
          way["leisure"="golf_course"](around:${radius * 1609.34},${latitude},${longitude});
          relation["leisure"="golf_course"](around:${radius * 1609.34},${latitude},${longitude});
        );
        out center meta;
      `;
      
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`
      });

      if (!response.ok) {
        throw new Error('Failed to fetch golf courses');
      }

      const data = await response.json();
      
      const foundCourses: GolfCourse[] = data.elements
        .map((element: any) => {
          const lat = element.type === 'way' ? element.center?.lat : element.lat;
          const lon = element.type === 'way' ? element.center?.lon : element.lon;
          
          if (!lat || !lon) return null;
          
          const name = element.tags?.name || 
                      element.tags?.brand || 
                      element.tags?.operator || 
                      'Golf Course';
          
          const address = [
            element.tags?.['addr:street'],
            element.tags?.['addr:city'],
            element.tags?.['addr:state']
          ].filter(Boolean).join(', ') || 'Address not available';

          // Calculate distance
          const distance = calculateDistance(latitude, longitude, lat, lon);

          return {
            name,
            address,
            latitude: lat,
            longitude: lon,
            distance
          };
        })
        .filter((course: GolfCourse | null) => course !== null)
        .sort((a: GolfCourse, b: GolfCourse) => (a.distance || 0) - (b.distance || 0))
        .slice(0, 20); // Limit to 20 courses

      // Add some popular courses if we don't find many
      if (foundCourses.length < 3) {
        const popularCourses = getPopularCourses(latitude, longitude);
        foundCourses.push(...popularCourses);
      }

      setCourses(foundCourses);
      return foundCourses;
    } catch (error) {
      console.error('Error fetching golf courses:', error);
      toast.error('Failed to load nearby golf courses');
      
      // Fallback to popular courses
      const popularCourses = getPopularCourses(latitude, longitude);
      setCourses(popularCourses);
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
    // Some popular golf courses with approximate locations
    const popular = [
      { name: "Pebble Beach Golf Links", address: "1700 17-Mile Drive, Pebble Beach, CA", lat: 36.5694, lon: -121.9469 },
      { name: "Augusta National Golf Club", address: "2604 Washington Road, Augusta, GA", lat: 33.5028, lon: -82.0201 },
      { name: "TPC Sawgrass", address: "110 Championship Way, Ponte Vedra Beach, FL", lat: 30.1958, lon: -81.3959 },
      { name: "Bethpage Black Course", address: "99 Quaker Meeting House Rd, Farmingdale, NY", lat: 40.7456, lon: -73.4593 },
      { name: "Torrey Pines Golf Course", address: "11480 N Torrey Pines Rd, La Jolla, CA", lat: 32.8998, lon: -117.2573 },
      { name: "Whistling Straits", address: "W12782 Whistling Straits Dr, Sheboygan, WI", lat: 43.6636, lon: -87.7981 },
      { name: "Pinehurst No. 2", address: "1 Carolina Vista Dr, Pinehurst, NC", lat: 35.1959, lon: -79.4678 },
      { name: "Kiawah Island Ocean Course", address: "1000 Ocean Course Dr, Kiawah Island, SC", lat: 32.5732, lon: -80.0364 }
    ];

    return popular.map(course => ({
      name: course.name,
      address: course.address,
      latitude: course.lat,
      longitude: course.lon,
      distance: calculateDistance(latitude, longitude, course.lat, course.lon)
    })).sort((a, b) => a.distance - b.distance).slice(0, 5);
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
    formatDistance
  };
};