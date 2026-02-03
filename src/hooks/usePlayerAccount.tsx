import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface PlayerAccount {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export function usePlayerAccount() {
  const [account, setAccount] = useState<PlayerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAccount();
      
      // Subscribe to real-time updates
      const channel = supabase
        .channel('account-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'player_accounts',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Account changed:', payload);
            fetchAccount();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setAccount(null);
      setLoading(false);
    }
  }, [user]);

  const fetchAccount = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('player_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Create account if it doesn't exist with $500 (50000 cents) play money
        const { data: newAccount, error: createError } = await supabase
          .from('player_accounts')
          .insert({ user_id: user.id, balance: 50000 })
          .select()
          .single();

        if (createError) throw createError;
        setAccount(newAccount);
      } else {
        setAccount(data);
      }
    } catch (error) {
      console.error('Error fetching account:', error);
      toast.error('Failed to load account information');
    } finally {
      setLoading(false);
    }
  };

  const requestPayout = async (amount: number) => {
    if (!user || !account) {
      toast.error('No account found');
      return { error: 'No account found' };
    }

    // Balance is stored in cents, convert to dollars for comparison
    const balanceInDollars = parseFloat(account.balance.toString()) / 100;
    if (amount <= 0 || amount > balanceInDollars) {
      toast.error('Invalid payout amount');
      return { error: 'Invalid amount' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('process-payout', {
        body: { amount },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      toast.success('Payout processed successfully!');
      await fetchAccount(); // Refresh balance
      return { data };
    } catch (error: any) {
      console.error('Payout error:', error);
      toast.error(error.message || 'Failed to process payout');
      return { error: error.message };
    }
  };

  return {
    account,
    loading,
    requestPayout,
    refetch: fetchAccount,
  };
}
