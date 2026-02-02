import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { mapDatabaseError } from '@/lib/errorHandling';
import { saveScoreOffline, getAllOfflineScores } from '@/lib/offlineDb';
import { syncOfflineScores } from '@/lib/scoreSync';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export interface MatchScore {
  id: string;
  match_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
  created_at: string;
  updated_at: string;
}

export interface PlayerScore {
  player_id: string;
  player_name: string;
  scores: { [hole: number]: number };
  front9: number;
  back9: number;
  total: number;
  handicap_index: number;
  course_handicap: number;
  net_front9: number;
  net_back9: number;
  net_total: number;
  status?: string;
}

export interface MatchData {
  id: string;
  course_name: string;
  location: string;
  hole_pars: { [hole: string]: number };
  tee_selection_mode?: 'fixed' | 'individual';
  default_tees?: string;
  scheduled_time?: string;
  format?: string;
  buy_in_amount?: number;
  participant_count?: number;
  max_participants?: number;
  status?: string;
  holes: number;
  double_down_enabled?: boolean;
  double_down_amount?: number;
  double_down_finalized?: boolean;
}

export interface MatchResult {
  id: string;
  match_id: string;
  winner_id: string | null;
  final_scores: any;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface PlayerConfirmation {
  player_id: string;
  player_name: string;
  confirmed: boolean;
  confirmed_at: string | null;
}

export function useMatchScoring(matchId: string) {
  const [scores, setScores] = useState<MatchScore[]>([]);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [confirmations, setConfirmations] = useState<PlayerConfirmation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  // Sync offline scores when coming back online
  useEffect(() => {
    if (isOnline && matchId && user) {
      const syncScores = async () => {
        try {
          await syncOfflineScores(matchId);
          // Refresh data after sync
          await fetchMatchData();
        } catch (error) {
          console.error('Error syncing offline scores:', error);
        }
      };
      syncScores();
    }
  }, [isOnline, matchId, user]);

  // Fetch match scores and results
  const fetchMatchData = async () => {
    if (!matchId || !user) return;

    try {
      setLoading(true);

      // Fetch match data including hole pars and tee settings
      const { data: matchInfo, error: matchError } = await supabase
        .from('matches')
        .select('id, course_name, location, hole_pars, tee_selection_mode, default_tees, scheduled_time, format, buy_in_amount, max_participants, status, holes')
        .eq('id', matchId)
        .single();

      if (matchError) {
        console.error('Error fetching match data:', matchError);
        return;
      }

      // Fetch participant count
      const { count: participantCount } = await supabase
        .from('match_participants')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchId);

      setMatchData({
        id: matchInfo.id,
        course_name: matchInfo.course_name,
        location: matchInfo.location,
        hole_pars: matchInfo.hole_pars as { [hole: string]: number },
        tee_selection_mode: matchInfo.tee_selection_mode as 'fixed' | 'individual' | undefined,
        default_tees: matchInfo.default_tees || undefined,
        scheduled_time: matchInfo.scheduled_time,
        format: matchInfo.format,
        buy_in_amount: matchInfo.buy_in_amount,
        participant_count: participantCount || 0,
        max_participants: matchInfo.max_participants,
        status: matchInfo.status,
        holes: matchInfo.holes || 18
      });
      
      console.log('✅ Match data loaded:', { 
        id: matchInfo.id, 
        status: matchInfo.status,
        isCancelled: matchInfo.status === 'cancelled',
        raw: matchInfo 
      });

      // Fetch scores
      const { data: scoresData, error: scoresError } = await supabase
        .from('match_scores')
        .select('*')
        .eq('match_id', matchId)
        .order('hole_number', { ascending: true });

      if (scoresError) {
        console.error('Error fetching scores:', scoresError);
        return;
      }

      setScores(scoresData || []);

      // Fetch match participants and their profile data
      const { data: participantData, error: participantsError } = await supabase
        .from('match_participants')
        .select('user_id, status')
        .eq('match_id', matchId);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        return;
      }

      // Get user IDs and fetch their profiles with handicaps
      const userIds = participantData?.map(p => p.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, handicap')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // Create participants array with profile data
      const participants = participantData?.map(participant => {
        const profile = profiles?.find(p => p.user_id === participant.user_id);
        return {
          user_id: participant.user_id,
          display_name: profile?.display_name || 'Unknown Player',
          handicap: profile?.handicap || 0,
          status: participant.status || 'active'
        };
      }) || [];

      // Process player scores with handicap calculations
      const playerScoresMap: { [playerId: string]: PlayerScore } = {};
      const slopeRating = 113; // Standard slope rating
      
      participants.forEach((participant: any) => {
        const handicapIndex = participant.handicap || 0;
        const courseHandicap = Math.round((handicapIndex * slopeRating) / 113);
        
        playerScoresMap[participant.user_id] = {
          player_id: participant.user_id,
          player_name: participant.display_name || 'Unknown Player',
          scores: {},
          front9: 0,
          back9: 0,
          total: 0,
          handicap_index: handicapIndex,
          course_handicap: courseHandicap,
          net_front9: 0,
          net_back9: 0,
          net_total: 0,
          status: participant.status || 'active'
        };
      });

      // Add scores to players
      scoresData?.forEach((score) => {
        if (playerScoresMap[score.player_id]) {
          playerScoresMap[score.player_id].scores[score.hole_number] = score.strokes;
        }
      });

      // Calculate totals and net scores
      Object.values(playerScoresMap).forEach((player) => {
        // Calculate front 9 (holes 1-9)
        player.front9 = Object.entries(player.scores)
          .filter(([hole]) => parseInt(hole) >= 1 && parseInt(hole) <= 9)
          .reduce((sum, [, strokes]) => sum + strokes, 0);
        
        // Calculate back 9 (holes 10-18)
        player.back9 = Object.entries(player.scores)
          .filter(([hole]) => parseInt(hole) >= 10 && parseInt(hole) <= 18)
          .reduce((sum, [, strokes]) => sum + strokes, 0);
        
        // Calculate gross total
        player.total = player.front9 + player.back9;
        
        // Calculate net scores (gross - course handicap)
        const halfHandicap = Math.floor(player.course_handicap / 2);
        player.net_front9 = player.front9 - halfHandicap;
        player.net_back9 = player.back9 - (player.course_handicap - halfHandicap);
        player.net_total = player.total - player.course_handicap;
      });

      setPlayerScores(Object.values(playerScoresMap));

      // Fetch match result
      const { data: resultData, error: resultError } = await supabase
        .from('match_results')
        .select('*')
        .eq('match_id', matchId)
        .maybeSingle();

      if (resultError && resultError.code !== 'PGRST116') {
        console.error('Error fetching match result:', resultError);
        return;
      }

      setMatchResult(resultData);

      // Fetch confirmations
      const { data: confirmationsData, error: confirmationsError } = await supabase
        .from('match_confirmations')
        .select('player_id, confirmed, confirmed_at')
        .eq('match_id', matchId);

      if (confirmationsError) {
        console.error('Error fetching confirmations:', confirmationsError);
      }

      // Map confirmations with player names
      const confirmationsWithNames: PlayerConfirmation[] = participants.map(participant => {
        const confirmation = confirmationsData?.find(c => c.player_id === participant.user_id);
        return {
          player_id: participant.user_id,
          player_name: participant.display_name,
          confirmed: confirmation?.confirmed || false,
          confirmed_at: confirmation?.confirmed_at || null
        };
      });

      setConfirmations(confirmationsWithNames);

    } catch (error) {
      console.error('Error in fetchMatchData:', error);
      toast({
        title: "Error loading match data",
        description: "Failed to load match scores and results",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Start match
  const startMatch = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to start a match",
        variant: "destructive",
      });
      return false;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase.rpc('start_match', {
        match_id: matchId
      });

      if (error) {
        console.error('Error starting match:', error);
        toast({
          title: "Failed to start match",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Match started!",
        description: "The match has begun. Good luck!",
      });

      return true;
    } catch (error) {
      console.error('Error starting match:', error);
      toast({
        title: "Failed to start match",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Update score for a hole
  const updateScore = async (holeNumber: number, strokes: number) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to update scores",
        variant: "destructive",
      });
      return false;
    }

    if (strokes < 1 || strokes > 10) {
      toast({
        title: "Invalid score",
        description: "Strokes must be between 1 and 10",
        variant: "destructive",
      });
      return false;
    }

    try {
      setSaving(true);

      // Optimistically update local state first
      setPlayerScores(prevScores => {
        return prevScores.map(player => {
          if (player.player_id === user.id) {
            const updatedScores = { ...player.scores, [holeNumber]: strokes };
            
            // Recalculate gross totals
            const front9 = Object.entries(updatedScores)
              .filter(([hole]) => parseInt(hole) <= 9)
              .reduce((sum, [, score]) => sum + score, 0);
            
            const back9 = Object.entries(updatedScores)
              .filter(([hole]) => parseInt(hole) >= 10)
              .reduce((sum, [, score]) => sum + score, 0);
            
            const total = front9 + back9;
            
            // Recalculate net scores
            const halfHandicap = Math.floor(player.course_handicap / 2);
            const net_front9 = front9 - halfHandicap;
            const net_back9 = back9 - (player.course_handicap - halfHandicap);
            const net_total = total - player.course_handicap;
            
            return {
              ...player,
              scores: updatedScores,
              front9,
              back9,
              total,
              net_front9,
              net_back9,
              net_total
            };
          }
          return player;
        });
      });

      // Save offline first (always)
      await saveScoreOffline(matchId, user.id, holeNumber, strokes);
      console.log('💾 Score saved offline');

      // If online, try to sync immediately
      if (isOnline) {
        const { error } = await supabase
          .from('match_scores')
          .upsert({
            match_id: matchId,
            player_id: user.id,
            hole_number: holeNumber,
            strokes: strokes
          }, {
            onConflict: 'match_id,player_id,hole_number'
          });

        if (error) {
          // Revert optimistic update on error
          await fetchMatchData();
          const safeMessage = mapDatabaseError(error);
          toast({
            title: "Failed to update score",
            description: safeMessage + " Score saved offline.",
            variant: "destructive",
          });
          return false;
        }
        console.log('✅ Score synced to server');
      } else {
        // Offline - score already saved to IndexedDB
        toast({
          title: "Score saved offline",
          description: "Your score will sync when you're back online.",
        });
      }

      return true;
    } catch (error) {
      console.error('Error updating score:', error);
      // Revert optimistic update on error
      await fetchMatchData();
      toast({
        title: "Failed to update score",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Finalize match results
  const finalizeResults = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to finalize results",
        variant: "destructive",
      });
      return false;
    }

    // Block finalization when offline
    if (!isOnline) {
      toast({
        title: "Cannot finalize offline",
        description: "You must be online to finalize match results. Your scores are saved and will sync when you reconnect.",
        variant: "destructive",
      });
      return false;
    }

    try {
      setSaving(true);

      const { error } = await supabase.rpc('finalize_match_results', {
        p_match_id: matchId
      });

      if (error) {
        console.error('Error finalizing results:', error);
        toast({
          title: "Failed to finalize results",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Results finalized!",
        description: "Match results have been calculated",
      });

      // Refresh data
      await fetchMatchData();
      return true;
    } catch (error) {
      console.error('Error finalizing results:', error);
      toast({
        title: "Failed to finalize results",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Confirm match results
  const confirmResults = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to confirm results",
        variant: "destructive",
      });
      return false;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('match_confirmations')
        .upsert({
          match_id: matchId,
          player_id: user.id,
          confirmed: true,
          confirmed_at: new Date().toISOString()
        }, {
          onConflict: 'match_id,player_id'
        });

      if (error) {
        console.error('Error confirming results:', error);
        toast({
          title: "Failed to confirm results",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Results confirmed!",
        description: "Waiting for other players to confirm...",
      });

      // Refresh data to get updated confirmations
      await fetchMatchData();

      // Check if all players have confirmed
      const { data: allConfirmations } = await supabase
        .from('match_confirmations')
        .select('confirmed')
        .eq('match_id', matchId)
        .eq('confirmed', true);

      const { count: participantCount } = await supabase
        .from('match_participants')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchId);

      // If all players have confirmed, finalize the match
      if (allConfirmations && participantCount && allConfirmations.length === participantCount) {
        toast({
          title: "All players confirmed!",
          description: "Finalizing match results...",
        });
        
        await finalizeResults();
      }

      return true;
    } catch (error) {
      console.error('Error confirming results:', error);
      toast({
        title: "Failed to confirm results",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Set up real-time subscriptions
  useEffect(() => {
    if (!matchId) return;

    fetchMatchData();

    // Subscribe to score changes (only from other players)
    const scoreChannel = supabase
      .channel(`match-scores-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_scores',
          filter: `match_id=eq.${matchId}`
        },
        (payload) => {
          // Only refetch if the change is from another player
          if (payload.new && 'player_id' in payload.new && payload.new.player_id !== user?.id) {
            fetchMatchData();
          }
        }
      )
      .subscribe();

    // Subscribe to result changes
    const resultChannel = supabase
      .channel(`match-results-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_results',
          filter: `match_id=eq.${matchId}`
        },
        () => {
          fetchMatchData();
        }
      )
      .subscribe();

    // Subscribe to confirmation changes
    const confirmationChannel = supabase
      .channel(`match-confirmations-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_confirmations',
          filter: `match_id=eq.${matchId}`
        },
        async (payload) => {
          // Refetch to update confirmation status
          await fetchMatchData();
          
          // Check if all players have confirmed and auto-finalize
          const { data: allConfirmations } = await supabase
            .from('match_confirmations')
            .select('confirmed')
            .eq('match_id', matchId)
            .eq('confirmed', true);

          const { count: participantCount } = await supabase
            .from('match_participants')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', matchId);

          // If all players have confirmed, finalize the match
          if (allConfirmations && participantCount && allConfirmations.length === participantCount) {
            const { data: existingResult } = await supabase
              .from('match_results')
              .select('id')
              .eq('match_id', matchId)
              .maybeSingle();
            
            // Only finalize if not already finalized
            if (!existingResult) {
              toast({
                title: "All players confirmed!",
                description: "Finalizing match results...",
              });
              await finalizeResults();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scoreChannel);
      supabase.removeChannel(resultChannel);
      supabase.removeChannel(confirmationChannel);
    };
  }, [matchId, user]);

  // Check if all holes are completed for current user (supports 9 or 18 holes)
  const isCurrentPlayerComplete = () => {
    if (!user || !matchData) return false;
    const userScore = playerScores.find(p => p.player_id === user.id);
    if (!userScore) return false;
    const requiredHoles = matchData.holes || 18;
    return Object.keys(userScore.scores).length >= requiredHoles;
  };

  // Check if a specific player has completed all their holes
  const isPlayerComplete = (playerId: string) => {
    if (!matchData) return false;
    const playerScore = playerScores.find(p => p.player_id === playerId);
    if (!playerScore) return false;
    const requiredHoles = matchData.holes || 18;
    return Object.keys(playerScore.scores).length >= requiredHoles;
  };

  // Check if current user has already confirmed/finished
  const hasCurrentPlayerFinished = () => {
    if (!user) return false;
    const confirmation = confirmations.find(c => c.player_id === user.id);
    return confirmation?.confirmed || false;
  };

  // Check if all players have finished (completed holes AND confirmed)
  const allPlayersFinished = () => {
    if (!matchData || playerScores.length === 0) return false;
    const requiredHoles = matchData.holes || 18;
    
    // All players must have completed all holes AND confirmed
    return playerScores.every(player => {
      const hasAllScores = Object.keys(player.scores).length >= requiredHoles;
      const hasConfirmed = confirmations.find(c => c.player_id === player.player_id)?.confirmed || false;
      return hasAllScores && hasConfirmed;
    });
  };

  // Legacy compatibility - check if all holes completed for current user
  const isMatchComplete = () => {
    return isCurrentPlayerComplete();
  };

  // Legacy compatibility - check if all players completed all holes (but not necessarily confirmed)
  const canFinalize = () => {
    if (!matchData) return false;
    const requiredHoles = matchData.holes || 18;
    return playerScores.every(player => Object.keys(player.scores).length >= requiredHoles);
  };

  const recordDoubleDownVote = async (optedIn: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('record-double-down-vote', {
        body: { matchId, optedIn },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      // Check if we need to process payments
      if (data.allAgreed && data.needsProcessing) {
        return processDoubleDownPayments();
      }

      return data;
    } catch (error: any) {
      console.error('Error recording double down vote:', error);
      toast({ title: "Error", description: error.message || 'Failed to record vote', variant: "destructive" });
      throw error;
    }
  };

  const processDoubleDownPayments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('process-double-down-payments', {
        body: { matchId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      toast({ title: "Success", description: "Double down activated! Payments processed." });
      await fetchMatchData(); // Refresh match data
      
      return data;
    } catch (error: any) {
      console.error('Error processing double down payments:', error);
      toast({ title: "Error", description: error.message || 'Failed to process payments', variant: "destructive" });
      throw error;
    }
  };

  return {
    scores,
    playerScores,
    matchResult,
    matchData,
    confirmations,
    loading,
    saving,
    startMatch,
    updateScore,
    finalizeResults,
    confirmResults,
    recordDoubleDownVote,
    processDoubleDownPayments,
    isMatchComplete: isMatchComplete(),
    canFinalize: canFinalize(),
    isCurrentPlayerComplete: isCurrentPlayerComplete(),
    hasCurrentPlayerFinished: hasCurrentPlayerFinished(),
    allPlayersFinished: allPlayersFinished(),
    isPlayerComplete,
    refetch: fetchMatchData
  };
}