import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BlockedState {
  state_code: string;
  state_name: string;
  reason: string | null;
}

interface GeoLocation {
  state: string | null;
  stateCode: string | null;
  country: string | null;
  isBlocked: boolean;
  isLoading: boolean;
  error: string | null;
}

interface GeoBlockingContextType extends GeoLocation {
  blockedStates: BlockedState[];
  getStateName: (code: string) => string;
  refetchBlockedStates: () => Promise<void>;
}

const GeoBlockingContext = createContext<GeoBlockingContextType | null>(null);

export const GeoBlockingProvider = ({ children }: { children: ReactNode }) => {
  const [blockedStates, setBlockedStates] = useState<BlockedState[]>([]);
  const [location, setLocation] = useState<GeoLocation>({
    state: null,
    stateCode: null,
    country: null,
    isBlocked: false,
    isLoading: true,
    error: null,
  });

  const fetchBlockedStates = async () => {
    try {
      const { data, error } = await supabase
        .from('blocked_states')
        .select('state_code, state_name, reason')
        .eq('is_active', true);

      if (error) throw error;
      setBlockedStates(data || []);
      return data || [];
    } catch (error) {
      console.error('Failed to fetch blocked states:', error);
      return [];
    }
  };

  useEffect(() => {
    const detectLocation = async () => {
      try {
        // Fetch blocked states from database first
        const states = await fetchBlockedStates();
        const blockedCodes = states.map(s => s.state_code);

        // Use ipapi.co for geolocation
        const response = await fetch('https://ipapi.co/json/', {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error('Failed to detect location');
        }
        
        const data = await response.json();
        
        const stateCode = data.region_code || null;
        
        // Determine if blocked by state only
        const isBlocked = data.country_code === 'US' && blockedCodes.includes(stateCode);
        
        setLocation({
          state: data.region || null,
          stateCode,
          country: data.country_code || null,
          isBlocked,
          isLoading: false,
          error: null,
        });

        // Store in session for subsequent checks
        if (stateCode) {
          sessionStorage.setItem('geo_state_code', stateCode);
          sessionStorage.setItem('geo_country', data.country_code || '');
        }
      } catch {
        // Silently handle geo detection failures - expected when CSP blocks or network issues occur
        // Try to use cached data
        const cachedState = sessionStorage.getItem('geo_state_code');
        const cachedCountry = sessionStorage.getItem('geo_country');
        
        if (cachedState && blockedStates.length > 0) {
          const blockedCodes = blockedStates.map(s => s.state_code);
          const stateName = blockedStates.find(s => s.state_code === cachedState)?.state_name || cachedState;
          const isBlocked = cachedCountry === 'US' && blockedCodes.includes(cachedState);
          
          setLocation({
            state: stateName,
            stateCode: cachedState,
            country: cachedCountry,
            isBlocked,
            isLoading: false,
            error: null,
          });
        } else {
          // Allow access if we can't determine location (fail-open for usability)
          setLocation({
            state: null,
            stateCode: null,
            country: null,
            isBlocked: false,
            isLoading: false,
            error: 'Could not determine location',
          });
        }
      }
    };

    detectLocation();
  }, []);

  const getStateName = (code: string) => {
    const state = blockedStates.find(s => s.state_code === code);
    return state?.state_name || code;
  };

  const refetchBlockedStates = async () => {
    await fetchBlockedStates();
  };

  return (
    <GeoBlockingContext.Provider value={{ 
      ...location, 
      blockedStates,
      getStateName,
      refetchBlockedStates
    }}>
      {children}
    </GeoBlockingContext.Provider>
  );
};

export const useGeoBlocking = () => {
  const context = useContext(GeoBlockingContext);
  if (!context) {
    throw new Error('useGeoBlocking must be used within a GeoBlockingProvider');
  }
  return context;
};
