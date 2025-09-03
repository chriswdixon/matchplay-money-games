import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Match {
  id: string;
  created_by: string;
  course_name: string;
  location: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  scheduled_time: string;
  format: string;
  buy_in_amount: number;
  handicap_min?: number;
  handicap_max?: number;
  max_participants: number;
  status: 'open' | 'full' | 'started' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  participant_count?: number;
  user_joined?: boolean;
  distance_km?: number;
}

export const useMatches = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMatches = async (userLocation?: { latitude: number; longitude: number }) => {
    try {
      setLoading(true);
      
      let matchesData;
      
      // If user location is provided, use GPS-based matching
      if (userLocation) {
        const { data, error } = await supabase
          .rpc('get_nearby_matches', {
            user_lat: userLocation.latitude,
            user_lon: userLocation.longitude,
            radius_km: 50
          });
        
        if (error) throw error;
        matchesData = data;
      } else {
        // Fallback to regular matching
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('status', 'open')
          .order('scheduled_time', { ascending: true });

        if (error) throw error;
        matchesData = data;
      }

      // Get participant counts for each match
      const matchesWithCounts = await Promise.all(
        (matchesData || []).map(async (match) => {
          const { data: participantCount } = await supabase
            .rpc('get_match_participant_count', { match_id: match.id });
          
          let userJoined = false;
          if (user) {
            const { data: joined } = await supabase
              .rpc('user_joined_match', { 
                match_id: match.id, 
                user_id: user.id 
              });
            userJoined = joined || false;
          }

          return {
            ...match,
            status: match.status as 'open' | 'full' | 'started' | 'completed' | 'cancelled',
            participant_count: participantCount || 0,
            user_joined: userJoined,
            distance_km: match.distance_km || undefined
          } as Match;
        })
      );

      setMatches(matchesWithCounts);
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast.error('Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const createMatch = async (matchData: {
    course_name: string;
    location: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    scheduled_time: string;
    format: string;
    buy_in_amount: number;
    handicap_min?: number;
    handicap_max?: number;
    max_participants: number;
  }) => {
    if (!user) {
      toast.error('You must be logged in to create a match');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          ...matchData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Automatically join the creator to the match
      await supabase
        .from('match_participants')
        .insert({
          match_id: data.id,
          user_id: user.id
        });

      toast.success('Match created successfully!');
      fetchMatches(); // Refresh the list
      return { data, error: null };
    } catch (error) {
      console.error('Error creating match:', error);
      toast.error('Failed to create match');
      return { error, data: null };
    }
  };

  const joinMatch = async (matchId: string) => {
    if (!user) {
      toast.error('You must be logged in to join a match');
      return { error: 'Not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('match_participants')
        .insert({
          match_id: matchId,
          user_id: user.id
        });

      if (error) throw error;

      toast.success('Successfully joined the match!');
      fetchMatches(); // Refresh the list
      return { error: null };
    } catch (error) {
      console.error('Error joining match:', error);
      toast.error('Failed to join match');
      return { error };
    }
  };

  const leaveMatch = async (matchId: string) => {
    if (!user) {
      toast.error('You must be logged in to leave a match');
      return { error: 'Not authenticated' };
    }

    try {
      const { error } = await supabase
        .from('match_participants')
        .delete()
        .eq('match_id', matchId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Left the match successfully');
      fetchMatches(); // Refresh the list
      return { error: null };
    } catch (error) {
      console.error('Error leaving match:', error);
      toast.error('Failed to leave match');
      return { error };
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [user]);

  return {
    matches,
    loading,
    createMatch,
    joinMatch,
    leaveMatch,
    refetch: fetchMatches
  };
};