import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface MatchScore {
  match_id: string;
  total_score: number;
  course_rating: number;
  slope_rating: number;
  par: number;
  tees_played: string;
  completed_at: string;
}

export function useHandicapCalculation() {
  const { user } = useAuth();
  const [completedMatches, setCompletedMatches] = useState<MatchScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchCount, setMatchCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchCompletedMatches();
  }, [user]);

  const fetchCompletedMatches = async () => {
    if (!user) return;

    try {
      // First, get match IDs where user participated and match is completed
      const { data: participations, error: partError } = await supabase
        .from('match_participants')
        .select('match_id, selected_tees')
        .eq('user_id', user.id);

      if (partError) throw partError;
      if (!participations || participations.length === 0) {
        setMatchCount(0);
        setCompletedMatches([]);
        setLoading(false);
        return;
      }

      const matchIds = participations.map(p => p.match_id);

      // Get completed matches
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('id, status')
        .in('id', matchIds)
        .eq('status', 'completed')
        .limit(20);

      if (matchError) throw matchError;
      if (!matches || matches.length === 0) {
        setMatchCount(0);
        setCompletedMatches([]);
        setLoading(false);
        return;
      }

      const completedMatchIds = matches.map(m => m.id);

      // Get match results for completed matches
      const { data: results, error: resultError } = await supabase
        .from('match_results')
        .select('match_id, completed_at')
        .in('match_id', completedMatchIds)
        .order('completed_at', { ascending: false });

      if (resultError) throw resultError;

      // Get scores for user in these matches
      const { data: scores, error: scoreError } = await supabase
        .from('match_scores')
        .select('match_id, strokes')
        .in('match_id', completedMatchIds)
        .eq('player_id', user.id);

      if (scoreError) throw scoreError;

      // Process matches to calculate totals
      const processedMatches: MatchScore[] = [];

      for (const match of matches) {
        const matchScores = scores?.filter(s => s.match_id === match.id) || [];
        
        if (matchScores.length === 0) continue;

        const totalScore = matchScores.reduce((sum, score) => sum + (score.strokes || 0), 0);
        
        const matchResult = results?.find(r => r.match_id === match.id);
        const participation = participations.find(p => p.match_id === match.id);

        // Get course info - using defaults for now
        // In production, you'd want to store course rating/slope with the match
        const courseRating = 72.0;
        const slopeRating = 113;
        const par = 72;

        processedMatches.push({
          match_id: match.id,
          total_score: totalScore,
          course_rating: courseRating,
          slope_rating: slopeRating,
          par: par,
          tees_played: participation?.selected_tees || 'white',
          completed_at: matchResult?.completed_at || '',
        });
      }

      // Sort by completion date
      processedMatches.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );

      setMatchCount(processedMatches.length);
      setCompletedMatches(processedMatches);
    } catch (error) {
      console.error('Error fetching completed matches:', error);
      setMatchCount(0);
      setCompletedMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateHandicapIndex = (): number | null => {
    if (completedMatches.length < 3) return null;

    // Calculate Score Differential for each round
    const differentials = completedMatches.map((match) => {
      // Score Differential = (Adjusted Gross Score - Course Rating) × (113 / Slope Rating)
      const differential =
        ((match.total_score - match.course_rating) * 113) / match.slope_rating;
      return differential;
    });

    // Sort differentials (lowest to highest)
    differentials.sort((a, b) => a - b);

    // Determine how many scores to use based on total rounds
    let numScoresToUse = 1;
    const numRounds = differentials.length;

    if (numRounds >= 20) {
      numScoresToUse = 8;
    } else if (numRounds >= 9) {
      numScoresToUse = Math.floor(numRounds * 0.4);
    } else if (numRounds >= 6) {
      numScoresToUse = Math.min(3, Math.floor(numRounds / 2));
    } else if (numRounds >= 4) {
      numScoresToUse = 2;
    } else if (numRounds === 3) {
      numScoresToUse = 1;
    }

    // Take the best (lowest) differentials
    const bestDifferentials = differentials.slice(0, numScoresToUse);

    // Calculate average
    const average =
      bestDifferentials.reduce((sum, diff) => sum + diff, 0) /
      bestDifferentials.length;

    // Handicap Index = average × 0.96 (96% multiplier per USGA rules)
    const handicapIndex = average * 0.96;

    // Round to one decimal place
    return Math.round(handicapIndex * 10) / 10;
  };

  const canEditHandicap = matchCount < 3;

  return {
    completedMatches,
    matchCount,
    loading,
    calculateHandicapIndex,
    canEditHandicap,
    refetch: fetchCompletedMatches,
  };
}
