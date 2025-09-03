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
  const [isRefetching, setIsRefetching] = useState(false);
  const { user } = useAuth();

  const fetchMatches = async (userLocation?: { latitude: number; longitude: number }) => {
    // Prevent multiple simultaneous calls
    if (isRefetching) return;
    
    try {
      setIsRefetching(true);
      if (!loading) setLoading(true);
      
      let matchesData;
      
      console.log('Fetching matches with location:', userLocation);
      
      // If user location is provided, use GPS-based matching
      if (userLocation) {
        try {
          const { data, error } = await supabase
            .rpc('get_nearby_matches', {
              user_lat: userLocation.latitude,
              user_lon: userLocation.longitude,
              radius_km: 30 // Changed from 50 to 30 miles
            });
          
          if (error) {
            console.error('GPS-based matching failed:', error);
            throw error;
          }
          matchesData = data || [];
        } catch (gpsError) {
          console.log('GPS matching failed, falling back to regular matching');
          // Fallback to regular matching if GPS fails
          const { data, error } = await supabase
            .from('matches')
            .select('*')
            .eq('status', 'open')
            .order('scheduled_time', { ascending: true });

          if (error) throw error;
          matchesData = data || [];
        }
      } else {
        // Regular matching
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('status', 'open')
          .order('scheduled_time', { ascending: true });

        if (error) throw error;
        matchesData = data || [];
      }

      console.log('Raw matches data:', matchesData);

      // Get participant counts for each match with better error handling
      const matchesWithCounts = await Promise.all(
        matchesData.map(async (match) => {
          let participantCount = 0;
          let userJoined = false;

          try {
            const { data: countData, error: countError } = await supabase
              .rpc('get_match_participant_count', { match_id: match.id });
            
            if (!countError && countData !== null) {
              participantCount = countData;
            }
          } catch (error) {
            console.error(`Error getting participant count for match ${match.id}:`, error);
          }
          
          if (user) {
            try {
              const { data: joinedData, error: joinedError } = await supabase
                .rpc('user_joined_match', { 
                  match_id: match.id, 
                  user_id: user.id 
                });
              
              if (!joinedError && joinedData !== null) {
                userJoined = joinedData;
              }
            } catch (error) {
              console.error(`Error checking if user joined match ${match.id}:`, error);
            }
          }

          return {
            ...match,
            status: match.status as 'open' | 'full' | 'started' | 'completed' | 'cancelled',
            participant_count: participantCount,
            user_joined: userJoined,
            distance_km: match.distance_km || undefined
          } as Match;
        })
      );

      console.log('Processed matches:', matchesWithCounts);
      setMatches(matchesWithCounts);
      
      // Show info message if no matches found
      if (matchesWithCounts.length === 0 && !loading) {
        console.log('No matches found');
      }
      
    } catch (error) {
      console.error('Error fetching matches:', error);
      
      // Only show error toast if it's not a network connectivity issue
      if (error?.message?.includes('Failed to fetch')) {
        console.warn('Network connectivity issue, will retry...');
        // Set empty array but don't show error toast for network issues
        setMatches([]);
      } else {
        toast.error('Unable to load matches. Please try again.');
        setMatches([]);
      }
    } finally {
      setLoading(false);
      setIsRefetching(false);
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
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Failed to create match - no data returned');

      // Automatically join the creator to the match
      const { error: joinError } = await supabase
        .from('match_participants')
        .insert({
          match_id: data.id,
          user_id: user.id
        });

      if (joinError) {
        console.error('Failed to auto-join creator to match:', joinError);
        // Don't fail the whole operation if auto-join fails
      }

      toast.success('Match created successfully!');
      
      // Refresh the list with a small delay to ensure data consistency
      setTimeout(() => fetchMatches(), 500);
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
      // Refresh the list with a small delay to ensure data consistency
      setTimeout(() => fetchMatches(), 500);
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
      // Refresh the list with a small delay to ensure data consistency
      setTimeout(() => fetchMatches(), 500);
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