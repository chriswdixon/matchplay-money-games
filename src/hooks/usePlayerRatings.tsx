import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface RateablePlayer {
  user_id: string;
  display_name: string;
  already_rated: boolean;
}

export interface PlayerRating {
  id: string;
  rater_id: string;
  rated_player_id: string;
  match_id: string;
  rating: number;
  created_at: string;
  updated_at: string;
}

export const usePlayerRatings = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const getRateablePlayersForMatch = useCallback(async (matchId: string): Promise<RateablePlayer[]> => {
    if (!user) return [];
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_rateable_players_for_match', {
          match_id: matchId,
          rater_user_id: user.id
        });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching rateable players:', error);
      toast.error('Failed to load players for rating');
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const ratePlayer = useCallback(async (
    matchId: string, 
    ratedPlayerId: string, 
    rating: number
  ): Promise<boolean> => {
    if (!user) {
      toast.error('You must be logged in to rate players');
      return false;
    }

    if (rating < 1 || rating > 5) {
      toast.error('Rating must be between 1 and 5 stars');
      return false;
    }

    try {
      setLoading(true);
      
      // Check if rating already exists and update or insert
      const { data: existingRating } = await supabase
        .from('player_ratings')
        .select('*')
        .eq('rater_id', user.id)
        .eq('rated_player_id', ratedPlayerId)
        .eq('match_id', matchId)
        .maybeSingle();

      if (existingRating) {
        // Update existing rating
        const { error } = await supabase
          .from('player_ratings')
          .update({ rating })
          .eq('id', existingRating.id);

        if (error) throw error;
        toast.success('Rating updated successfully');
      } else {
        // Insert new rating
        const { error } = await supabase
          .from('player_ratings')
          .insert({
            rater_id: user.id,
            rated_player_id: ratedPlayerId,
            match_id: matchId,
            rating
          });

        if (error) throw error;
        toast.success('Player rated successfully');
      }

      return true;
    } catch (error: any) {
      console.error('Error rating player:', error);
      
      if (error.message?.includes('no_self_rating')) {
        toast.error('You cannot rate yourself');
      } else if (error.message?.includes('not participated')) {
        toast.error('You can only rate players you played with');
      } else {
        toast.error('Failed to rate player');
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getPlayerRating = useCallback(async (
    matchId: string, 
    ratedPlayerId: string
  ): Promise<number | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('player_ratings')
        .select('rating')
        .eq('rater_id', user.id)
        .eq('rated_player_id', ratedPlayerId)
        .eq('match_id', matchId)
        .maybeSingle();

      if (error) throw error;
      return data?.rating || null;
    } catch (error) {
      console.error('Error fetching player rating:', error);
      return null;
    }
  }, [user]);

  return {
    loading,
    getRateablePlayersForMatch,
    ratePlayer,
    getPlayerRating
  };
};