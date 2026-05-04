import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationError {
  code: number;
  message: string;
}

export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);

  const getCurrentLocation = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = {
          code: 0,
          message: 'Geolocation is not supported by this browser'
        };
        reject(error);
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          setLocation(location);
          setLoading(false);
          resolve(location);
        },
        (error) => {
          const locationError = {
            code: error.code,
            message: getErrorMessage(error.code)
          };
          setError(locationError);
          setLoading(false);
          reject(locationError);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  const getErrorMessage = (code: number): string => {
    switch (code) {
      case 1:
        return 'Location access denied by user';
      case 2:
        return 'Location unavailable';
      case 3:
        return 'Location request timed out';
      default:
        return 'An unknown error occurred';
    }
  };

  const requestLocation = useCallback(async () => {
    try {
      await getCurrentLocation();
      toast.success('Location found successfully');
    } catch (error) {
      const locationError = error as LocationError;
      toast.error(locationError.message);
    }
  }, []);

  // Auto-request location on mount if permission is already granted (or prompt-able silently).
  useEffect(() => {
    if (location || loading) return;
    if (!navigator.geolocation) return;

    const start = () => {
      getCurrentLocation().catch(() => {
        // Silent — user can manually enable later
      });
    };

    if ((navigator as any).permissions?.query) {
      (navigator as any).permissions
        .query({ name: 'geolocation' })
        .then((status: PermissionStatus) => {
          // Only auto-fetch when permission is already granted.
          // On iOS Safari, calling getCurrentPosition() without a user
          // gesture (e.g. on mount during 'prompt' state) triggers the
          // permission dialog out of context and gets auto-denied,
          // permanently sticking the page to "denied".
          if (status.state === 'granted') {
            start();
          }
        })
        .catch(() => {
          // Permissions API unavailable — do NOT auto-request; wait for
          // an explicit user gesture (e.g. button click).
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert address to coordinates using a geocoding service
  const geocodeAddress = async (address: string): Promise<Location | null> => {
    try {
      // Detect if it's a zipcode (5 digits, optionally with -4 digits)
      const isZipcode = /^\d{5}(-\d{4})?$/.test(address.trim());
      
      console.log('🌍 Geocoding address:', address);
      
      // Use geocode.xyz for zipcode lookups (CORS-friendly, free tier)
      if (isZipcode) {
        const geocodeUrl = `https://geocode.xyz/${encodeURIComponent(address)}?json=1&region=US`;
        console.log('📡 Using geocode.xyz API:', geocodeUrl);
        
        const response = await fetch(geocodeUrl);
        console.log('📊 Response status:', response.status);
        
        if (!response.ok) {
          console.error('❌ Geocode.xyz API failed:', response.status);
          throw new Error(`Geocode.xyz API failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📦 Geocode.xyz response:', data);
        
        if (data?.latt && data?.longt && data.latt !== "0" && data.longt !== "0") {
          const result = {
            latitude: parseFloat(data.latt),
            longitude: parseFloat(data.longt)
          };
          console.log('✅ Found coordinates:', result);
          return result;
        }
      }
      
      // For non-zipcode addresses, use Nominatim
      const searchQuery = isZipcode ? `${address}, USA` : address;
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=us`;
      console.log('📡 Using Nominatim API:', nominatimUrl);
      
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'TycheGolfApp/1.0 (contact@example.com)'
        }
      });
      
      console.log('📊 Response status:', response.status);
      
      if (!response.ok) {
        console.error('❌ Nominatim API failed:', response.status);
        throw new Error(`Nominatim API failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📦 Nominatim response:', data);
      
      if (data && data.length > 0) {
        const result = {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
        console.log('✅ Found coordinates:', result);
        return result;
      }
      
      console.warn('⚠️ No results found for:', address);
      return null;
    } catch (error) {
      console.error('❌ Geocoding error:', error);
      return null;
    }
  };

  // Calculate distance between two points
  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
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

  const formatDistance = (distanceMiles: number): string => {
    if (distanceMiles < 0.1) {
      return `${Math.round(distanceMiles * 5280)} ft`;
    } else if (distanceMiles < 10) {
      return `${distanceMiles.toFixed(1)} miles`;
    } else {
      return `${Math.round(distanceMiles)} miles`;
    }
  };

  return {
    location,
    loading,
    error,
    getCurrentLocation,
    requestLocation,
    geocodeAddress,
    calculateDistance,
    formatDistance
  };
};