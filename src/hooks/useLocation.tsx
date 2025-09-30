import { useState, useEffect } from 'react';
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

  const requestLocation = async () => {
    try {
      await getCurrentLocation();
      toast.success('Location found successfully');
    } catch (error) {
      const locationError = error as LocationError;
      toast.error(locationError.message);
    }
  };

  // Convert address to coordinates using a geocoding service
  const geocodeAddress = async (address: string): Promise<Location | null> => {
    try {
      // Detect if it's a zipcode (5 digits, optionally with -4 digits)
      const isZipcode = /^\d{5}(-\d{4})?$/.test(address.trim());
      
      // For zipcodes, append USA to improve geocoding accuracy
      const searchQuery = isZipcode ? `${address}, USA` : address;
      
      console.log('Geocoding address:', searchQuery);
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=us`
      );
      const data = await response.json();
      
      console.log('Geocoding response:', data);
      
      if (data && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon)
        };
      }
      return null;
    } catch (error) {
      console.error('Geocoding failed:', error);
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
    if (distanceMiles < 1) {
      return `${Math.round(distanceMiles * 5280)}ft`;
    } else if (distanceMiles < 10) {
      return `${distanceMiles.toFixed(1)}mi`;
    } else {
      return `${Math.round(distanceMiles)}mi`;
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