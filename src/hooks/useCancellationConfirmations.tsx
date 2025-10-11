import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from './use-toast';

export interface CancellationConfirmation {
  id: string;
  match_id: string;
  cancelling_player_id: string;
  cancelling_player_name?: string;
  stated_reason: string;
  confirming_player_id: string;
  confirmed: boolean;
  alternate_reason?: string;
  confirmed_at?: string;
  created_at: string;
}

export function useCancellationConfirmations(matchId: string) {
  const { user } = useAuth();
  const [pendingConfirmations, setPendingConfirmations] = useState<CancellationConfirmation[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch pending confirmations
  useEffect(() => {
    if (!user || !matchId) return;

    const fetchConfirmations = async () => {
      const { data, error } = await supabase
        .from('match_cancellation_confirmations')
        .select('*')
        .eq('match_id', matchId)
        .eq('confirming_player_id', user.id)
        .eq('confirmed', false);

      if (error) {
        console.error('Error fetching cancellation confirmations:', error);
        return;
      }

      // Fetch player names separately
      const playerIds = [...new Set(data?.map(c => c.cancelling_player_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', playerIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      const confirmationsWithNames = data?.map(conf => ({
        ...conf,
        cancelling_player_name: profileMap.get(conf.cancelling_player_id) || 'Unknown Player'
      })) || [];

      setPendingConfirmations(confirmationsWithNames);
      setLoading(false);
    };

    fetchConfirmations();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`match_cancellations_${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_cancellation_confirmations',
          filter: `match_id=eq.${matchId}`
        },
        async (payload) => {
          if (payload.new.confirming_player_id === user.id && !payload.new.confirmed) {
            // Fetch the player name
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', payload.new.cancelling_player_id)
              .single();

            setPendingConfirmations(prev => [...prev, {
              ...payload.new as CancellationConfirmation,
              cancelling_player_name: profile?.display_name || 'Unknown Player'
            }]);

            toast({
              title: "Player Left Match",
              description: `${profile?.display_name || 'A player'} has left the match. Please confirm their reason.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_cancellation_confirmations',
          filter: `match_id=eq.${matchId}`
        },
        (payload) => {
          if (payload.new.confirming_player_id === user.id) {
            setPendingConfirmations(prev => 
              prev.filter(c => c.id !== payload.new.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, user]);

  const confirmCancellation = async (
    confirmationId: string, 
    confirmed: boolean, 
    alternateReason?: string
  ) => {
    const { error } = await supabase
      .from('match_cancellation_confirmations')
      .update({
        confirmed,
        alternate_reason: alternateReason,
        confirmed_at: new Date().toISOString()
      })
      .eq('id', confirmationId);

    if (error) {
      console.error('Error confirming cancellation:', error);
      toast({
        title: "Error",
        description: "Failed to submit confirmation. Please try again.",
        variant: "destructive"
      });
      return false;
    }

    setPendingConfirmations(prev => prev.filter(c => c.id !== confirmationId));
    
    toast({
      title: "Confirmation Submitted",
      description: "Your cancellation confirmation has been recorded.",
    });

    return true;
  };

  return {
    pendingConfirmations,
    loading,
    confirmCancellation
  };
}
