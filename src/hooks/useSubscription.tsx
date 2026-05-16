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
  status: string | null;
  cancelAtPeriodEnd: boolean;
  latestInvoiceStatus: string | null;
  latestInvoiceAmountDue: number | null;
  latestInvoiceHostedUrl: string | null;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Pure Play Money system — Stripe removed. All users are granted
// Tournament Pro tier for free. Tier name is cosmetic only.
const GRANTED_TIER = SUBSCRIPTION_TIERS.tournament_annual;

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const value: SubscriptionContextType = {
    subscribed: true,
    productId: user ? GRANTED_TIER.product_id : null,
    subscriptionEnd: null,
    loading: false,
    tierName: GRANTED_TIER.name,
    status: user ? 'active' : null,
    cancelAtPeriodEnd: false,
    latestInvoiceStatus: null,
    latestInvoiceAmountDue: null,
    latestInvoiceHostedUrl: null,
    refreshSubscription: async () => {},
  };

  return (
    <SubscriptionContext.Provider value={value}>
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
