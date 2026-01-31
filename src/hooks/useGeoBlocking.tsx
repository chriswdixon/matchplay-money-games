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
  isVPN: boolean;
  isProxy: boolean;
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
    isVPN: false,
    isProxy: false,
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

        // Use ipapi.co for geolocation (includes basic VPN detection on paid plans)
        // For enhanced VPN detection, we'll also check additional indicators
        const response = await fetch('https://ipapi.co/json/', {
          headers: { 'Accept': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error('Failed to detect location');
        }
        
        const data = await response.json();
        
        const stateCode = data.region_code || null;
        
        // VPN/Proxy detection heuristics
        let isVPN = false;
        let isProxy = false;
        
        // Check for common VPN indicators
        // 1. Data center ASN patterns (common for VPN providers)
        const vpnAsnPatterns = [
          'DIGITALOCEAN', 'AMAZON', 'GOOGLE', 'MICROSOFT', 'LINODE',
          'VULTR', 'OVH', 'HETZNER', 'CHOOPA', 'SERVERMANIA',
          'EXPRESSVPN', 'NORDVPN', 'SURFSHARK', 'CYBERGHOST', 'PIA',
          'MULLVAD', 'PROTONVPN', 'IPVANISH', 'TORGUARD', 'WINDSCRIBE'
        ];
        
        const org = (data.org || '').toUpperCase();
        const asn = (data.asn || '').toUpperCase();
        
        for (const pattern of vpnAsnPatterns) {
          if (org.includes(pattern) || asn.includes(pattern)) {
            isVPN = true;
            break;
          }
        }
        
        // 2. Check if timezone doesn't match the detected region
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const detectedTimezone = data.timezone;
        
        if (detectedTimezone && browserTimezone) {
          // Get timezone offset comparison
          const browserRegion = browserTimezone.split('/')[0];
          const detectedRegion = detectedTimezone.split('/')[0];
          
          // If continents don't match, likely VPN
          if (browserRegion !== detectedRegion) {
            isVPN = true;
          }
        }
        
        // 3. Check for WebRTC leak detection (browser vs IP mismatch)
        // This is done client-side to detect if user's real location differs
        try {
          const rtcCheck = await checkWebRTCLeak(data.ip);
          if (rtcCheck.mismatch) {
            isVPN = true;
          }
        } catch (e) {
          // WebRTC check failed, continue without it
        }
        
        // Determine if blocked (either by state or VPN/proxy usage)
        const isStateBlocked = data.country_code === 'US' && blockedCodes.includes(stateCode);
        const isBlocked = isStateBlocked || isVPN || isProxy;
        
        setLocation({
          state: data.region || null,
          stateCode,
          country: data.country_code || null,
          isBlocked,
          isLoading: false,
          error: null,
          isVPN,
          isProxy,
        });

        // Store in session for subsequent checks
        if (stateCode) {
          sessionStorage.setItem('geo_state_code', stateCode);
          sessionStorage.setItem('geo_country', data.country_code || '');
          sessionStorage.setItem('geo_is_vpn', String(isVPN));
        }
      } catch (error) {
        // Silently handle geo detection failures - this is expected when CSP blocks or network issues occur
        
        // Try to use cached data
        const cachedState = sessionStorage.getItem('geo_state_code');
        const cachedCountry = sessionStorage.getItem('geo_country');
        const cachedVPN = sessionStorage.getItem('geo_is_vpn') === 'true';
        
        if (cachedState && blockedStates.length > 0) {
          const blockedCodes = blockedStates.map(s => s.state_code);
          const stateName = blockedStates.find(s => s.state_code === cachedState)?.state_name || cachedState;
          const isStateBlocked = cachedCountry === 'US' && blockedCodes.includes(cachedState);
          
          setLocation({
            state: stateName,
            stateCode: cachedState,
            country: cachedCountry,
            isBlocked: isStateBlocked || cachedVPN,
            isLoading: false,
            error: null,
            isVPN: cachedVPN,
            isProxy: false,
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
            isVPN: false,
            isProxy: false,
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

// WebRTC leak detection helper
async function checkWebRTCLeak(detectedIP: string): Promise<{ mismatch: boolean }> {
  return new Promise((resolve) => {
    // Skip in environments without WebRTC
    if (typeof RTCPeerConnection === 'undefined') {
      resolve({ mismatch: false });
      return;
    }
    
    const timeout = setTimeout(() => {
      resolve({ mismatch: false });
    }, 3000);
    
    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      pc.createDataChannel('');
      
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        
        const candidate = event.candidate.candidate;
        const ipMatch = candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
        
        if (ipMatch) {
          const localIP = ipMatch[0];
          // If local IP differs significantly from detected IP, might be VPN
          // This is a simplified check - in production you'd want more sophisticated comparison
          if (localIP !== detectedIP && !localIP.startsWith('192.168.') && !localIP.startsWith('10.')) {
            clearTimeout(timeout);
            pc.close();
            resolve({ mismatch: true });
          }
        }
      };
      
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout);
          resolve({ mismatch: false });
        });
        
    } catch (e) {
      clearTimeout(timeout);
      resolve({ mismatch: false });
    }
  });
}

export const useGeoBlocking = () => {
  const context = useContext(GeoBlockingContext);
  if (!context) {
    throw new Error('useGeoBlocking must be used within a GeoBlockingProvider');
  }
  return context;
};
