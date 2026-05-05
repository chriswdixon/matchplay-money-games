import { useState, useCallback } from 'react';
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

const LAST_KNOWN_KEY = 'tyche-last-known-location';
const LAST_KNOWN_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

interface StoredLocation extends Location {
  timestamp: number;
}

const readLastKnown = (): StoredLocation | null => {
  try {
    const raw = localStorage.getItem(LAST_KNOWN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLocation;
    if (
      typeof parsed?.latitude !== 'number' ||
      typeof parsed?.longitude !== 'number' ||
      typeof parsed?.timestamp !== 'number'
    ) return null;
    if (Date.now() - parsed.timestamp > LAST_KNOWN_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeLastKnown = (loc: Location) => {
  try {
    const payload: StoredLocation = { ...loc, timestamp: Date.now() };
    localStorage.setItem(LAST_KNOWN_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode errors
  }
};

export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(() => readLastKnown());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LocationError | null>(null);

  // Try a single getCurrentPosition call with given options + a manual timeout guard
  // (some mobile browsers — especially iOS Safari — silently never fire callbacks).
  const tryGetPosition = (
    options: PositionOptions,
    manualTimeoutMs: number
  ): Promise<Location> => {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject({ code: 3, message: getErrorMessage(3) } as LocationError);
      }, manualTimeoutMs);

      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          },
          (err) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            reject({ code: err.code, message: getErrorMessage(err.code) } as LocationError);
          },
          options
        );
      } catch (e) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject({ code: 2, message: getErrorMessage(2) } as LocationError);
      }
    });
  };

  // IP-based coarse fallback for when device GPS is unavailable (airplane mode,
  // simulator, denied OS-level location, etc.). Best-effort, low accuracy.
  const ipFallback = async (): Promise<Location | null> => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) return null;
      const data = await res.json();
      if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          accuracy: 50000, // ~city level
        };
      }
    } catch {
      // ignore
    }
    return null;
  };

  const getCurrentLocation = async (): Promise<Location> => {
    if (!navigator.geolocation) {
      const err: LocationError = { code: 0, message: 'Geolocation is not supported by this browser' };
      setError(err);
      throw err;
    }

    setLoading(true);
    setError(null);

    // High-accuracy attempt first (GPS via iOS Core Location / Android FLP),
    // then graceful degradation. Each attempt has its own manual timeout guard.
    const attempts: Array<{ opts: PositionOptions; timeoutMs: number; label: string }> = [
      { label: 'gps',    opts: { enableHighAccuracy: true,  timeout: 8000,  maximumAge: 60000 },        timeoutMs: 9000 },
      { label: 'coarse', opts: { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },       timeoutMs: 16000 },
      { label: 'cached', opts: { enableHighAccuracy: false, timeout: 5000,  maximumAge: Infinity },     timeoutMs: 6000 },
    ];

    let lastError: LocationError | null = null;
    for (const attempt of attempts) {
      try {
        const loc = await tryGetPosition(attempt.opts, attempt.timeoutMs);
        setLocation(loc);
        writeLastKnown(loc);
        setLoading(false);
        return loc;
      } catch (e) {
        const le = e as LocationError;
        lastError = le;
        if (le.code === 1) break; // permission denied — no retry helps
      }
    }

    // Permission denied: surface the error, do not silently substitute.
    if (lastError?.code === 1) {
      setError(lastError);
      setLoading(false);
      throw lastError;
    }

    // Fallback 1: persisted last-known device location (≤24h old)
    const lastKnown = readLastKnown();
    if (lastKnown) {
      setLocation(lastKnown);
      setLoading(false);
      const ageMin = Math.round((Date.now() - lastKnown.timestamp) / 60000);
      toast.message('Using last known location', {
        description: `Couldn't get a fresh GPS fix — using your location from ${ageMin} min ago.`,
      });
      return lastKnown;
    }

    // Fallback 2: IP-based coarse location
    const ipLoc = await ipFallback();
    if (ipLoc) {
      setLocation(ipLoc);
      writeLastKnown(ipLoc);
      setLoading(false);
      toast.message('Using approximate location', {
        description: 'GPS unavailable — using your network location instead.',
      });
      return ipLoc;
    }

    const finalError: LocationError =
      lastError ?? { code: 2, message: getErrorMessage(2) };
    setError(finalError);
    setLoading(false);
    throw finalError;
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

  // Convert address to coordinates using a geocoding service
  const geocodeAddress = async (address: string): Promise<Location | null> => {
    try {
      // Detect if it's a zipcode (5 digits, optionally with -4 digits)
      const isZipcode = /^\d{5}(-\d{4})?$/.test(address.trim());
      
      console.log('🌍 Geocoding address:', address);
      
      // Use Zippopotam.us for US ZIP code lookups — free, CORS-enabled, no key, very reliable
      if (isZipcode) {
        const zip5 = address.trim().slice(0, 5);
        const zipUrl = `https://api.zippopotam.us/us/${zip5}`;
        console.log('📡 Using Zippopotam.us API:', zipUrl);

        try {
          const response = await fetch(zipUrl);
          console.log('📊 Response status:', response.status);

          if (response.ok) {
            const data = await response.json();
            const place = data?.places?.[0];
            if (place?.latitude && place?.longitude) {
              const result = {
                latitude: parseFloat(place.latitude),
                longitude: parseFloat(place.longitude),
              };
              console.log('✅ Found coordinates:', result);
              return result;
            }
          } else {
            console.warn('⚠️ Zippopotam.us failed, falling back to Nominatim');
          }
        } catch (zipErr) {
          console.warn('⚠️ Zippopotam.us error, falling back to Nominatim:', zipErr);
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