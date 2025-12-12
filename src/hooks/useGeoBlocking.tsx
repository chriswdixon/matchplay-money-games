import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

// States with unclear or restrictive skill-gaming regulations
// This list should be reviewed and updated by legal counsel
const BLOCKED_STATES = [
  'AZ', // Arizona - strict gambling laws
  'AR', // Arkansas - restrictive
  'CT', // Connecticut - unclear regulations
  'DE', // Delaware - state-controlled gaming
  'HI', // Hawaii - no legal gambling
  'ID', // Idaho - restrictive
  'IA', // Iowa - strict regulations
  'LA', // Louisiana - complex gaming laws
  'MT', // Montana - restrictive
  'NV', // Nevada - requires licensing
  'SD', // South Dakota - limited gaming
  'TN', // Tennessee - restrictive
  'UT', // Utah - no gambling allowed
  'WA', // Washington - strict regulations
];

// Display names for states
const STATE_NAMES: Record<string, string> = {
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IA': 'Iowa',
  'LA': 'Louisiana',
  'MT': 'Montana',
  'NV': 'Nevada',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'UT': 'Utah',
  'WA': 'Washington',
};

interface GeoLocation {
  state: string | null;
  stateCode: string | null;
  country: string | null;
  isBlocked: boolean;
  isLoading: boolean;
  error: string | null;
}

interface GeoBlockingContextType extends GeoLocation {
  blockedStates: string[];
  getStateName: (code: string) => string;
}

const GeoBlockingContext = createContext<GeoBlockingContextType | null>(null);

export const GeoBlockingProvider = ({ children }: { children: ReactNode }) => {
  const [location, setLocation] = useState<GeoLocation>({
    state: null,
    stateCode: null,
    country: null,
    isBlocked: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const detectLocation = async () => {
      try {
        // Use a free IP geolocation API
        const response = await fetch('https://ipapi.co/json/', {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error('Failed to detect location');
        }
        
        const data = await response.json();
        
        const stateCode = data.region_code || null;
        const isBlocked = data.country_code === 'US' && BLOCKED_STATES.includes(stateCode);
        
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
      } catch (error) {
        console.error('Geo detection error:', error);
        
        // Try to use cached data
        const cachedState = sessionStorage.getItem('geo_state_code');
        const cachedCountry = sessionStorage.getItem('geo_country');
        
        if (cachedState) {
          setLocation({
            state: STATE_NAMES[cachedState] || cachedState,
            stateCode: cachedState,
            country: cachedCountry,
            isBlocked: cachedCountry === 'US' && BLOCKED_STATES.includes(cachedState),
            isLoading: false,
            error: null,
          });
        } else {
          // Allow access if we can't determine location
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

  const getStateName = (code: string) => STATE_NAMES[code] || code;

  return (
    <GeoBlockingContext.Provider value={{ 
      ...location, 
      blockedStates: BLOCKED_STATES,
      getStateName 
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
