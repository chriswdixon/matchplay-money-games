import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AccountTransaction {
  id: string;
  user_id: string;
  account_id: string;
  amount: number;
  transaction_type: 'winning' | 'match_buyin' | 'match_cancellation' | 'subscription_charge' | 'coupon' | 'payout';
  match_id?: string;
  description: string;
  stripe_payment_intent_id?: string;
  metadata?: any;
  created_at: string;
}

export function useAccountTransactions() {
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchTransactions();

      // Subscribe to real-time updates
      const channel = supabase
        .channel('transaction-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'account_transactions',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('New transaction:', payload);
            fetchTransactions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setTransactions([]);
      setLoading(false);
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('account_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    transactions,
    loading,
    refetch: fetchTransactions,
  };
}
