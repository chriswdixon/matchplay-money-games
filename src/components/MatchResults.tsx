import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { useAuth } from '@/hooks/useAuth';
import { useFreeTier } from '@/hooks/useFreeTier';
import { Trophy, Crown, Medal, CheckCircle, Clock, Users, DollarSign, Lock } from 'lucide-react';
import { MatchResultsDisplay } from './MatchResultsDisplay';

interface MatchResultsProps {
  matchId: string;
  matchName: string;
  onClose: () => void;
}

export function MatchResults({ matchId, matchName, onClose }: MatchResultsProps) {
  const { user } = useAuth();
  const { hasAccess } = useFreeTier();
  const {
    playerScores,
    matchResult,
    matchData,
    loading,
    saving,
    confirmResults
  } = useMatchScoring(matchId);

  const [hasConfirmed, setHasConfirmed] = useState(false);
  
  const canViewDetails = hasAccess('match_details');

  const handleConfirm = async () => {
    const success = await confirmResults();
    if (success) {
      setHasConfirmed(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  // Sort players by net score (lowest first)
  const sortedPlayers = [...playerScores].sort((a, b) => {
    if (a.net_total === 0 && b.net_total === 0) return 0;
    if (a.net_total === 0) return 1;
    if (b.net_total === 0) return -1;
    return a.net_total - b.net_total;
  });

  const winner = sortedPlayers[0];

  const getPositionIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-5 h-5 text-warning" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-warning" />;
      default:
        return <Users className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getPositionText = (index: number) => {
    switch (index) {
      case 0:
        return '1st Place';
      case 1:
        return '2nd Place';
      case 2:
        return '3rd Place';
      default:
        return `${index + 1}th Place`;
    }
  };

  // If match is finalized, show the full results display
  if (matchResult) {
    if (!canViewDetails) {
      const myScore = playerScores.find((p) => p.player_id === user?.id);
      const winnerEntry = sortedPlayers[0];
      const isUserWinner = winnerEntry && user && winnerEntry.player_id === user.id;

      return (
        <div className="max-w-[1400px] mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Trophy className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Match Results</h1>
                <p className="text-muted-foreground">{matchName}</p>
              </div>
            </div>
            <Button variant="outline" onClick={onClose}>
              Back to Matches
            </Button>
          </div>

          {/* Winner */}
          {winnerEntry && winnerEntry.total > 0 && (
            <Card className="border-warning/30 bg-warning/10">
              <CardContent className="p-6 text-center space-y-1">
                <Crown className="w-8 h-8 text-warning mx-auto" />
                <h2 className="text-xl font-bold text-warning">
                  {isUserWinner ? "🏆 You Won!" : `🏆 Winner: ${winnerEntry.player_name}`}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Net Score: {winnerEntry.net_total} (Gross: {winnerEntry.total})
                </p>
              </CardContent>
            </Card>
          )}

          {/* Your scorecard */}
          {myScore && (
            <Card>
              <CardHeader>
                <CardTitle>Your Results</CardTitle>
                <CardDescription>Your final scorecard for this match</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold">{myScore.total > 0 ? myScore.total : 'DNF'}</div>
                    <div className="text-xs text-muted-foreground">Gross</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{myScore.net_total > 0 ? myScore.net_total : 'DNF'}</div>
                    <div className="text-xs text-muted-foreground">Net</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{myScore.course_handicap}</div>
                    <div className="text-xs text-muted-foreground">Course HCP</div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Hole</th>
                        {Array.from({ length: 18 }, (_, i) => (
                          <th key={i + 1} className="text-center p-1 w-8">{i + 1}</th>
                        ))}
                        <th className="text-center p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="p-2 font-medium">You</td>
                        {Array.from({ length: 18 }, (_, i) => (
                          <td key={i + 1} className="text-center p-1">{myScore.scores[i + 1] || '-'}</td>
                        ))}
                        <td className="text-center p-2 font-bold">{myScore.total > 0 ? myScore.total : 'DNF'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription>
              <strong>Upgrade for full results</strong>
              <p className="mt-2">
                Local Player and Tournament Pro members see every player's full scorecard, statistics, and payout breakdown.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-primary rounded-lg">
              <Trophy className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Match Results</h1>
              <p className="text-muted-foreground">{matchName}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onClose}>
            Back to Matches
          </Button>
        </div>

        <MatchResultsDisplay 
          matchResult={matchResult}
          playerScores={playerScores}
          buyInAmount={matchData?.buy_in_amount}
          maxParticipants={matchData?.max_participants}
        />
      </div>
    );
  }

  // Otherwise show the confirmation view
  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Trophy className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Match Results</h1>
            <p className="text-muted-foreground">{matchName}</p>
          </div>
        </div>
        <Button variant="outline" onClick={onClose}>
          Back to Matches
        </Button>
      </div>

      {/* Winner Announcement */}
      {winner && winner.net_total > 0 && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              <Crown className="w-8 h-8 text-warning" />
              <div className="text-center">
                <h2 className="text-2xl font-bold text-warning">🏆 Winner!</h2>
                <p className="text-xl font-semibold">{winner.player_name}</p>
                <p className="text-lg text-muted-foreground">
                  Net Score: {winner.net_total} (Gross: {winner.total})
                </p>
                <p className="text-sm text-muted-foreground">
                  Handicap: {winner.handicap_index.toFixed(1)} (Course: {winner.course_handicap})
                </p>
              </div>
              <Crown className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Final Leaderboard</CardTitle>
          <CardDescription>
            Final results for all players in the match
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedPlayers.map((player, index) => (
              <div
                key={player.player_id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  index === 0 ? 'border-warning/30 bg-warning/10' : 'border-border bg-background'
                } ${
                  player.player_id === user?.id ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  {getPositionIcon(index)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-lg">{player.player_name}</span>
                      {player.player_id === user?.id && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {getPositionText(index)}
                    </span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-2xl font-bold">
                    {player.net_total > 0 ? player.net_total : 'DNF'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Net Score (Gross: {player.total > 0 ? player.total : 'DNF'})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    HCP: {player.handicap_index.toFixed(1)} (CH: {player.course_handicap})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Object.keys(player.scores).length}/18 holes completed
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Scorecard */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Scorecard</CardTitle>
          <CardDescription>
            Hole-by-hole breakdown of all player scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 font-medium">Player</th>
                  {Array.from({ length: 18 }, (_, i) => (
                    <th key={i + 1} className="text-center p-2 font-medium w-12">
                      {i + 1}
                    </th>
                  ))}
                  <th className="text-center p-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player, index) => (
                  <tr 
                    key={player.player_id} 
                    className={`border-b ${
                      index === 0 ? 'bg-warning/10' : ''
                    } ${
                      player.player_id === user?.id ? 'bg-muted/20' : ''
                    }`}
                  >
                    <td className="p-2 font-medium">
                      <div className="flex items-center gap-2">
                        {getPositionIcon(index)}
                        {player.player_name}
                        {player.player_id === user?.id && (
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        )}
                      </div>
                    </td>
                    {Array.from({ length: 18 }, (_, i) => {
                      const hole = i + 1;
                      const score = player.scores[hole];

                      return (
                        <td key={hole} className="text-center p-2">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                            score ? 'bg-muted text-foreground' : 'bg-background border border-border'
                          }`}>
                            {score || '-'}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-center p-2 font-bold text-lg">
                      {player.total > 0 ? player.total : 'DNF'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Confirm Results</CardTitle>
          <CardDescription>
            All players must confirm these results to finalize the match
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            {!hasConfirmed ? (
              <Button
                onClick={handleConfirm}
                disabled={saving}
                className="bg-gradient-primary text-primary-foreground hover:shadow-premium"
              >
                {saving ? "Confirming..." : "Confirm Results"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Results Confirmed!</span>
              </div>
            )}
          </div>
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <Clock className="w-4 h-4 inline mr-1" />
            Waiting for all players to confirm the results
          </div>
        </CardContent>
      </Card>
    </div>
  );
}