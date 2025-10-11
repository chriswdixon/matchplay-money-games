import { useState, useEffect, useCallback, useRef } from 'react';
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
  booking_url?: string;
  tee_selection_mode: 'fixed' | 'individual';
  default_tees?: string;
}

export const useMatches = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Use refs to track ongoing requests and prevent race conditions
  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get match IDs where user is participating
  const getUserParticipatingMatchIds = async (): Promise<string> => {
    if (!user) return '';
    
    try {
      const { data, error } = await supabase
        .from('match_participants')
        .select('match_id')
        .eq('user_id', user.id);
      
      if (error || !data || data.length === 0) return '';
      
      return data.map(p => p.match_id).join(',');
    } catch (error) {
      console.error('Error getting user participating matches:', error);
      return '';
    }
  };

  const fetchMatches = useCallback(async (userLocation?: { latitude: number; longitude: number }, retryCount = 0) => {
    // Prevent multiple simultaneous calls
    if (isLoadingRef.current) {
      console.log('Fetch already in progress, skipping...');
      return;
    }
    
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear any pending retry
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      isLoadingRef.current = true;
      setLoading(true);
      
      console.log('Fetching matches...', { userLocation, retryCount });
      
      let matchesData: any[] = [];
      
      // Simple fallback-first approach - try basic query first
      try {
        let matchesQuery = supabase
          .from('matches')
          .select('*');

        // If user is logged in, get both open matches and matches they're participating in
        if (user) {
          const participatingMatchIds = await getUserParticipatingMatchIds();
          
          if (participatingMatchIds) {
            // Get open matches OR matches where user is a participant (started/completed/cancelled)
            matchesQuery = matchesQuery.or(`status.eq.open,and(status.in.(started,completed,cancelled),id.in.(${participatingMatchIds}))`);
          } else {
            // If no participating matches, just get open ones
            matchesQuery = matchesQuery.eq('status', 'open');
          }
        } else {
          // For non-logged in users, only show open matches
          matchesQuery = matchesQuery.eq('status', 'open');
        }

        const { data, error } = await matchesQuery
          .order('scheduled_time', { ascending: true })
          .abortSignal(abortControllerRef.current.signal);

        if (error) throw error;
        matchesData = data || [];
        console.log('Successfully fetched matches:', matchesData.length);
      } catch (basicError) {
        console.error('Basic query failed:', basicError);
        
        // If basic query fails due to network, don't try complex queries
        if (basicError.name === 'AbortError') {
          console.log('Request was aborted');
          return;
        }
        
        if (basicError.message?.includes('Failed to fetch')) {
          console.log('Network error, will retry...');
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            retryTimeoutRef.current = setTimeout(() => {
              fetchMatches(userLocation, retryCount + 1);
            }, delay);
            return;
          } else {
            throw new Error('Network connection failed after multiple attempts');
          }
        }
        throw basicError;
      }

      // Only try location-based matching if we have location and basic query succeeded
      if (userLocation && matchesData.length < 20) {
        try {
          console.log('Trying location-based matching...');
          const { data: nearbyData, error: nearbyError } = await supabase
            .rpc('get_nearby_matches', {
              user_lat: userLocation.latitude,
              user_lon: userLocation.longitude,
              radius_km: 30
            })
            .abortSignal(abortControllerRef.current.signal);
          
          if (!nearbyError && nearbyData && nearbyData.length > 0) {
            console.log('Found nearby matches:', nearbyData.length);
            matchesData = nearbyData;
          }
        } catch (nearbyError) {
          console.log('Location-based matching failed, using basic results:', nearbyError);
          // Continue with basic results
        }
      }

      // Process matches with participant info (simplified approach)
      const processedMatches = await Promise.all(
        matchesData.slice(0, 50).map(async (match) => { // Limit to 50 matches for performance
          // Set defaults first
          let participantCount = 0;
          let userJoined = false;

          // Try to get participant count, but don't fail if it errors
          try {
            if (abortControllerRef.current?.signal.aborted) return null;
            
            const { data: countData } = await supabase
              .rpc('get_match_participant_count', { match_id: match.id })
              .abortSignal(abortControllerRef.current.signal);
            
            if (countData !== null) participantCount = countData;
          } catch (error) {
            console.log(`Participant count failed for match ${match.id}, using default`);
          }
          
          // Try to check if user joined, but don't fail if it errors
          if (user) {
            try {
              if (abortControllerRef.current?.signal.aborted) return null;
              
              const { data: joinedData } = await supabase
                .rpc('user_joined_match', { 
                  match_id: match.id, 
                  user_id: user.id 
                })
                .abortSignal(abortControllerRef.current.signal);
              
              if (joinedData !== null) userJoined = joinedData;
            } catch (error) {
              console.log(`User joined check failed for match ${match.id}, using default`);
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

      // Filter out any null results from aborted requests
      const validMatches = processedMatches.filter(Boolean) as Match[];
      
      if (!abortControllerRef.current?.signal.aborted) {
        console.log('Setting matches:', validMatches.length);
        setMatches(validMatches);
        
        // Reset retry count on success
        if (retryCount > 0) {
          console.log('Successfully recovered after', retryCount, 'retries');
        }
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted, ignoring error');
        return;
      }
      
      console.error('Error fetching matches:', error);
      
      // Only show user-facing errors for non-network issues
      if (!error.message?.includes('Failed to fetch') && !error.message?.includes('Network')) {
        toast.error('Unable to load matches. Please refresh the page.');
      }
      
      // Set empty matches on error (but only if not aborted)
      if (!abortControllerRef.current?.signal.aborted) {
        setMatches([]);
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [user]);

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
    booking_url?: string;
    tee_selection_mode: 'fixed' | 'individual';
    default_tees?: string;
  }, userLocation?: { latitude: number; longitude: number }) => {
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
      
      // Refresh will happen automatically via realtime subscription
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

  const isMatchCreator = useCallback(async (matchId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .rpc('is_match_creator', { match_id: matchId });
      
      if (error) {
        console.error('Error checking match creator:', error);
        return false;
      }
      
      return data || false;
    } catch (error) {
      console.error('Error checking match creator:', error);
      return false;
    }
  }, [user]);

  // Cleanup function
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Set up realtime subscription for match updates
  useEffect(() => {
    const channel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches'
        },
        (payload) => {
          console.log('Match change detected:', payload);
          // Refresh matches when any change occurs
          setTimeout(() => fetchMatches(), 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMatches]);

  // Initial load
  useEffect(() => {
    // Small delay to prevent multiple rapid calls
    const timer = setTimeout(() => {
      fetchMatches();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [fetchMatches]);

  const updateMatch = async (matchId: string, matchData: {
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
    booking_url?: string | null;
    tee_selection_mode: 'fixed' | 'individual';
    default_tees?: string | null;
  }) => {
    if (!user) {
      toast.error('You must be logged in to update a match');
      return { error: 'Not authenticated' };
    }

    try {
      const { data, error } = await supabase
        .from('matches')
        .update(matchData)
        .eq('id', matchId)
        .eq('created_by', user.id) // Ensure only the creator can update
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Failed to update match - no data returned or unauthorized');

      // Refresh the matches list
      fetchMatches();
      return { success: true, data };
    } catch (error: any) {
      console.error('Error updating match:', error);
      toast.error(error.message || 'Failed to update match');
      return { error: error.message };
    }
  };

  return {
    matches,
    loading,
    createMatch,
    updateMatch,
    joinMatch,
    leaveMatch,
    isMatchCreator,
    refetch: fetchMatches
  };
};