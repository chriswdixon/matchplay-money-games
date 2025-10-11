import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface HoleScore {
  hole_number: number;
  strokes: number;
  par: number;
}

interface MatchScore {
  match_id: string;
  hole_scores: HoleScore[];
  course_rating: number;
  slope_rating: number;
  course_handicap: number;
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
      // Get user's current handicap for course handicap calculation
      const { data: profile } = await supabase
        .from('profiles')
        .select('handicap')
        .eq('user_id', user.id)
        .single();

      const currentHandicap = profile?.handicap || 0;

      // Get match IDs where user participated and match is completed
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

      // Get completed matches with hole_pars
      const { data: matches, error: matchError } = await supabase
        .from('matches')
        .select('id, status, hole_pars')
        .in('id', matchIds)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
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
        .in('match_id', completedMatchIds);

      if (resultError) throw resultError;

      // Get hole-by-hole scores for user in these matches
      const { data: scores, error: scoreError } = await supabase
        .from('match_scores')
        .select('match_id, hole_number, strokes')
        .in('match_id', completedMatchIds)
        .eq('player_id', user.id)
        .order('hole_number', { ascending: true });

      if (scoreError) throw scoreError;

      // Process matches with hole-by-hole scores
      const processedMatches: MatchScore[] = [];

      for (const match of matches) {
        const matchScores = scores?.filter(s => s.match_id === match.id) || [];
        
        // Only include matches with all 18 holes completed
        if (matchScores.length !== 18) continue;

        const matchResult = results?.find(r => r.match_id === match.id);
        
        // Get hole pars from match data
        const holePars = match.hole_pars as { [key: string]: number };
        
        // Create hole scores with pars
        const holeScores: HoleScore[] = matchScores.map(score => ({
          hole_number: score.hole_number,
          strokes: score.strokes || 0,
          par: holePars[score.hole_number.toString()] || 4
        }));

        // Use standard course rating and slope (in production, store these with match)
        const courseRating = 72.0;
        const slopeRating = 113;
        
        // Calculate course handicap at the time of play
        const courseHandicap = Math.round((currentHandicap * slopeRating) / 113);

        processedMatches.push({
          match_id: match.id,
          hole_scores: holeScores,
          course_rating: courseRating,
          slope_rating: slopeRating,
          course_handicap: courseHandicap,
          completed_at: matchResult?.completed_at || '',
        });
      }

      // Sort by completion date (most recent first), limit to 20
      processedMatches.sort((a, b) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );

      setMatchCount(processedMatches.length);
      setCompletedMatches(processedMatches.slice(0, 20));
    } catch (error) {
      console.error('Error fetching completed matches:', error);
      setMatchCount(0);
      setCompletedMatches([]);
    } finally {
      setLoading(false);
    }
  };

  // Apply Net Double Bogey adjustment to a round
  const applyNetDoubleBogeyAdjustment = (match: MatchScore): number => {
    const { hole_scores, course_handicap } = match;
    
    // Distribute handicap strokes across holes (stroke allocation)
    // Typically holes are ranked by difficulty (handicap 1-18)
    // For simplicity, we'll distribute strokes evenly, giving extra strokes to harder holes
    const strokesPerHole: { [hole: number]: number } = {};
    
    // Each player gets strokes on holes based on their course handicap
    // If CH = 10, player gets 1 stroke on the 10 hardest holes
    // If CH = 20, player gets 1 stroke on all holes, 2 strokes on 2 hardest
    for (let hole = 1; hole <= 18; hole++) {
      const baseStrokes = Math.floor(course_handicap / 18);
      const extraStrokes = hole <= (course_handicap % 18) ? 1 : 0;
      strokesPerHole[hole] = baseStrokes + extraStrokes;
    }
    
    // Apply Net Double Bogey cap to each hole
    let adjustedGrossScore = 0;
    
    for (const holeScore of hole_scores) {
      const { hole_number, strokes, par } = holeScore;
      const handicapStrokes = strokesPerHole[hole_number] || 0;
      
      // Net Double Bogey = Par + 2 + handicap strokes received
      const netDoubleBogey = par + 2 + handicapStrokes;
      
      // Cap the score at Net Double Bogey
      const cappedScore = Math.min(strokes, netDoubleBogey);
      adjustedGrossScore += cappedScore;
    }
    
    return adjustedGrossScore;
  };

  const calculateHandicapIndex = (): number | null => {
    if (completedMatches.length < 3) return null;

    // Calculate Score Differential for each round using Net Double Bogey adjusted scores
    const differentials = completedMatches.map((match) => {
      // Apply Net Double Bogey adjustment
      const adjustedGrossScore = applyNetDoubleBogeyAdjustment(match);
      
      // Score Differential = (Adjusted Gross Score - Course Rating) × (113 / Slope Rating)
      const differential =
        ((adjustedGrossScore - match.course_rating) * 113) / match.slope_rating;
      return differential;
    });

    // Sort differentials (lowest to highest)
    differentials.sort((a, b) => a - b);

    // Determine how many scores to use based on total rounds (USGA rules)
    let numScoresToUse = 1;
    const numRounds = differentials.length;

    if (numRounds >= 20) {
      numScoresToUse = 8; // Best 8 of 20
    } else if (numRounds >= 19) {
      numScoresToUse = 7;
    } else if (numRounds >= 18) {
      numScoresToUse = 6;
    } else if (numRounds >= 15) {
      numScoresToUse = 5;
    } else if (numRounds >= 12) {
      numScoresToUse = 4;
    } else if (numRounds >= 9) {
      numScoresToUse = 3;
    } else if (numRounds >= 6) {
      numScoresToUse = 2;
    } else if (numRounds >= 3) {
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
