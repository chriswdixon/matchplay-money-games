import { usePrivateProfile } from './usePrivateProfile';

export function useFreeTier() {
  const { privateData, loading } = usePrivateProfile();
  
  const isFree = !privateData?.membership_tier || privateData.membership_tier === 'Free';
  
  return {
    isFree,
    loading,
    hasAccess: (feature: 'buy_in' | 'handicap_calculation' | 'account_tab' | 'gps_matching' | 'match_details') => {
      if (loading) return false;
      if (!isFree) return true;
      
      // Free tier restrictions - account_tab is always accessible for play money
      if (feature === 'account_tab') return true;
      
      return false;
    }
  };
}
