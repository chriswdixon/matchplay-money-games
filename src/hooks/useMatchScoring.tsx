import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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
  total: number;
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

export function useMatchScoring(matchId: string) {
  const [scores, setScores] = useState<MatchScore[]>([]);
  const [playerScores, setPlayerScores] = useState<PlayerScore[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch match scores and results
  const fetchMatchData = async () => {
    if (!matchId || !user) return;

    try {
      setLoading(true);

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

      // Fetch match participants to get player names
      const { data: participants, error: participantsError } = await supabase
        .from('match_participants')
        .select(`
          user_id,
          profiles!inner(display_name)
        `)
        .eq('match_id', matchId);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        return;
      }

      // Process player scores
      const playerScoresMap: { [playerId: string]: PlayerScore } = {};
      
      participants.forEach((participant: any) => {
        playerScoresMap[participant.user_id] = {
          player_id: participant.user_id,
          player_name: participant.profiles.display_name || 'Unknown Player',
          scores: {},
          total: 0
        };
      });

      // Add scores to players
      scoresData?.forEach((score) => {
        if (playerScoresMap[score.player_id]) {
          playerScoresMap[score.player_id].scores[score.hole_number] = score.strokes;
        }
      });

      // Calculate totals
      Object.values(playerScoresMap).forEach((player) => {
        player.total = Object.values(player.scores).reduce((sum, strokes) => sum + strokes, 0);
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
        console.error('Error updating score:', error);
        toast({
          title: "Failed to update score",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }

      // Refresh data
      await fetchMatchData();
      return true;
    } catch (error) {
      console.error('Error updating score:', error);
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

    try {
      setSaving(true);

      const { error } = await supabase.rpc('finalize_match_results', {
        match_id: matchId
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
        description: "You have confirmed the match results",
      });

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

    // Subscribe to score changes
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
        () => {
          fetchMatchData();
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

    return () => {
      supabase.removeChannel(scoreChannel);
      supabase.removeChannel(resultChannel);
    };
  }, [matchId, user]);

  // Check if all holes are completed for current user
  const isMatchComplete = () => {
    if (!user) return false;
    const userScore = playerScores.find(p => p.player_id === user.id);
    if (!userScore) return false;
    return Object.keys(userScore.scores).length === 18;
  };

  // Check if current user can finalize (all players have completed all holes)
  const canFinalize = () => {
    return playerScores.every(player => Object.keys(player.scores).length === 18);
  };

  return {
    scores,
    playerScores,
    matchResult,
    loading,
    saving,
    startMatch,
    updateScore,
    finalizeResults,
    confirmResults,
    isMatchComplete: isMatchComplete(),
    canFinalize: canFinalize(),
    refetch: fetchMatchData
  };
}