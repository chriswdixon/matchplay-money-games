import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Subscription tier configuration
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Free',
    price_id: null,
    product_id: null,
    price: 0,
    interval: 'year',
  },
  local_annual: {
    name: 'Local Player',
    price_id: 'price_1SKTL96uJFnpPt7J4mdFJvNy',
    product_id: 'prod_TH1NGRzUcNgjSU',
    price: 49,
    interval: 'year',
  },
  local_monthly: {
    name: 'Local Player',
    price_id: 'price_1SKTOQ6uJFnpPt7JP69j9nwf',
    product_id: 'prod_TH1RlFcAZFBdpM',
    price: 59,
    interval: 'month',
  },
  tournament_annual: {
    name: 'Tournament Pro',
    price_id: 'price_1SKTOd8xKJwJeHGF0yvxWiHG',
    product_id: 'prod_TH1R2bg1DUOQM0',
    price: 99,
    interval: 'year',
  },
  tournament_monthly: {
    name: 'Tournament Pro',
    price_id: 'price_1SKTOs6uJFnpPt7JmGqFsBdN',
    product_id: 'prod_TH1RYr33oxFnRb',
    price: 109,
    interval: 'month',
  },
} as const;

// Legacy tier mapping for backwards compatibility
export const LEGACY_TIERS = {
  local: SUBSCRIPTION_TIERS.local_annual,
  tournament: SUBSCRIPTION_TIERS.tournament_annual,
} as const;

interface SubscriptionContextType {
  subscribed: boolean;
  productId: string | null;
  subscriptionEnd: string | null;
  loading: boolean;
  tierName: string | null;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();
  const [subscribed, setSubscribed] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkSubscription = async () => {
    if (!user || !session) {
      setSubscribed(true); // Default to subscribed (Free tier)
      setProductId(null);
      setSubscriptionEnd(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('Error checking subscription:', error);
        setSubscribed(true); // Default to Free tier on error
        setProductId(null);
        setSubscriptionEnd(null);
      } else {
        // If no paid subscription, user is on Free tier
        setSubscribed(true);
        setProductId(data.product_id || null);
        setSubscriptionEnd(data.subscription_end || null);
      }
    } catch (error) {
      console.error('Exception checking subscription:', error);
      setSubscribed(true); // Default to Free tier on error
      setProductId(null);
      setSubscriptionEnd(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();

    // Auto-refresh every 60 seconds
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, session]);

  // Get tier name from product ID, default to Free
  const tierName = productId
    ? Object.entries(SUBSCRIPTION_TIERS).find(([_, tier]) => tier.product_id === productId)?.[1]?.name || 'Free'
    : 'Free';

  return (
    <SubscriptionContext.Provider
      value={{
        subscribed,
        productId,
        subscriptionEnd,
        loading,
        tierName,
        refreshSubscription: checkSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
