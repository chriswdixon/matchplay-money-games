import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { validateHolePars, DEFAULT_HOLE_PARS } from '@/lib/matchValidation';
import { createMatchSchema, sanitizeInput } from '@/lib/validation';
import { mapDatabaseError } from '@/lib/errorHandling';

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
  holes: number;
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
  winner_id?: string;
  is_team_format?: boolean;
  pin?: string;
  team2_pin?: string;
  team3_pin?: string;
  team4_pin?: string;
  team1_pin_creator?: string;
  team2_pin_creator?: string;
  team3_pin_creator?: string;
  team4_pin_creator?: string;
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

          // Fetch winner_id for completed matches
          let winnerId: string | undefined = undefined;
          if (match.status === 'completed') {
            try {
              if (abortControllerRef.current?.signal.aborted) return null;
              
              const { data: resultData } = await supabase
                .from('match_results')
                .select('winner_id')
                .eq('match_id', match.id)
                .single();
              
              if (resultData) winnerId = resultData.winner_id || undefined;
            } catch (error) {
              console.log(`Winner fetch failed for match ${match.id}`);
            }
          }

          return {
            ...match,
            status: match.status as 'open' | 'full' | 'started' | 'completed' | 'cancelled',
            participant_count: participantCount,
            user_joined: userJoined,
            distance_km: match.distance_km || undefined,
            winner_id: winnerId
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
    holes: number;
    buy_in_amount: number;
    handicap_min?: number;
    handicap_max?: number;
    max_participants: number;
    booking_url?: string;
    tee_selection_mode: 'fixed' | 'individual';
    default_tees?: string;
    hole_pars?: Record<string, number>;
    tee_data?: any;
  }, userLocation?: { latitude: number; longitude: number }) => {
    if (!user) {
      toast.error('You must be logged in to create a match');
      return { error: 'Not authenticated' };
    }

    try {
      // Sanitize text inputs
      const sanitizedData = {
        ...matchData,
        course_name: sanitizeInput(matchData.course_name),
        location: sanitizeInput(matchData.location || ''),
        address: matchData.address ? sanitizeInput(matchData.address) : undefined,
        booking_url: matchData.booking_url ? sanitizeInput(matchData.booking_url) : undefined,
      };

      // Validate match data
      const validationResult = createMatchSchema.safeParse(sanitizedData);
      if (!validationResult.success) {
        const errorMessage = validationResult.error.errors[0]?.message || "Invalid match data";
        toast.error(errorMessage);
        return { error: errorMessage };
      }

      // Validate hole_pars if provided, otherwise use default
      const holeParsToUse = matchData.hole_pars || DEFAULT_HOLE_PARS;
      const holeParsValidation = validateHolePars(holeParsToUse);
      
      if (!holeParsValidation.success) {
        toast.error(`Invalid hole pars: ${holeParsValidation.error}`);
        return { error: holeParsValidation.error };
      }

      const { data, error } = await supabase
        .from('matches')
        .insert({
          course_name: validationResult.data.course_name,
          location: validationResult.data.location,
          address: validationResult.data.address,
          latitude: validationResult.data.latitude,
          longitude: validationResult.data.longitude,
          scheduled_time: matchData.scheduled_time,
          format: validationResult.data.format,
          holes: matchData.holes,
          buy_in_amount: validationResult.data.buy_in_amount,
          handicap_min: validationResult.data.handicap_min,
          handicap_max: validationResult.data.handicap_max,
          max_participants: validationResult.data.max_participants,
          booking_url: validationResult.data.booking_url,
          tee_selection_mode: matchData.tee_selection_mode,
          default_tees: matchData.default_tees,
          hole_pars: holeParsValidation.data,
          pin: (matchData as any).pin || null,
          team1_pin_creator: (matchData as any).pin ? user.id : null,
          created_by: user.id,
          tee_data: matchData.tee_data || null
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Failed to create match - no data returned');

      // Automatically join the creator to the match FIRST (required for buy-in charge)
      const { error: joinError } = await supabase
        .from('match_participants')
        .insert({
          match_id: data.id,
          user_id: user.id
        });

      if (joinError) {
        // Rollback match creation
        await supabase.from('matches').delete().eq('id', data.id);
        throw new Error('Failed to add creator as participant: ' + mapDatabaseError(joinError));
      }

      // Charge buy-in if amount > 0 (creator must be participant first)
      if (data.buy_in_amount > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const { error: chargeError } = await supabase.functions.invoke('charge-match-buyin', {
          body: { matchId: data.id, buyInAmount: data.buy_in_amount },
          headers: { Authorization: `Bearer ${session?.access_token}` }
        });
        
        if (chargeError) {
          // Rollback match creation and participation
          await supabase.from('match_participants').delete().eq('match_id', data.id);
          await supabase.from('matches').delete().eq('id', data.id);
          throw new Error('Failed to charge buy-in: ' + chargeError.message);
        }
      }

      toast.success('Match created successfully!');
      
      return { data, error: null };
    } catch (error: any) {
      const safeMessage = mapDatabaseError(error);
      toast.error(safeMessage);
      return { error: error.message, data: null };
    }
  };

  const joinMatch = async (matchId: string, pin?: string, teamNumber?: number, setTeamPin?: string) => {
    if (!user) {
      toast.error('You must be logged in to join a match');
      return { error: 'Not authenticated' };
    }

    try {
      // Call secure server-side function for PIN validation and join
      const { data, error } = await supabase.rpc('validate_and_join_match', {
        p_match_id: matchId,
        p_pin: pin || null,
        p_team_number: teamNumber || null,
        p_set_team_pin: setTeamPin || null
      });

      if (error) throw error;

      // Handle response
      const result = data as { error?: string; success?: boolean; message?: string; retry_after?: number } | null;
      
      if (result && result.error) {
        toast.error(result.error);
        return { error: result.error };
      }

      if (result && result.success) {
        toast.success(result.message || 'Successfully joined the match!');
        setTimeout(() => fetchMatches(), 500);
        return { error: null };
      }

      throw new Error('Unexpected response from server');
    } catch (error: any) {
      console.error('Error joining match:', error);
      toast.error(error.message || 'Failed to join match');
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

  // Set up realtime subscription for match updates - only for user's matches
  useEffect(() => {
    if (!user) return;

    // Subscribe to matches where user is creator or participant
    const channel = supabase
      .channel(`matches-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'matches',
          filter: `created_by=eq.${user.id}`
        },
        (payload) => {
          console.log('Match change detected (creator):', payload);
          setTimeout(() => fetchMatches(), 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_participants',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Match participation change:', payload);
          setTimeout(() => fetchMatches(), 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMatches, user]);

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
    hole_pars?: Record<string, number>;
  }) => {
    if (!user) {
      toast.error('You must be logged in to update a match');
      return { error: 'Not authenticated' };
    }

    try {
      // Validate hole_pars if provided
      if (matchData.hole_pars) {
        const holeParsValidation = validateHolePars(matchData.hole_pars);
        
        if (!holeParsValidation.success) {
          toast.error(`Invalid hole pars: ${holeParsValidation.error}`);
          return { error: holeParsValidation.error };
        }
        
        matchData.hole_pars = holeParsValidation.data;
      }

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