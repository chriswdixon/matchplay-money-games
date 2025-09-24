import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMatchScoring } from '@/hooks/useMatchScoring';
import { useAuth } from '@/hooks/useAuth';
import { Trophy, Crown, Medal, CheckCircle, Clock, Users } from 'lucide-react';

interface MatchResultsProps {
  matchId: string;
  matchName: string;
  onClose: () => void;
}

export function MatchResults({ matchId, matchName, onClose }: MatchResultsProps) {
  const { user } = useAuth();
  const {
    playerScores,
    matchResult,
    loading,
    saving,
    confirmResults
  } = useMatchScoring(matchId);

  const [hasConfirmed, setHasConfirmed] = useState(false);

  const handleConfirm = async () => {
    const success = await confirmResults();
    if (success) {
      setHasConfirmed(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  // Sort players by score (lowest first)
  const sortedPlayers = [...playerScores].sort((a, b) => {
    if (a.total === 0 && b.total === 0) return 0;
    if (a.total === 0) return 1;
    if (b.total === 0) return -1;
    return a.total - b.total;
  });

  const winner = sortedPlayers[0];

  const getPositionIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-amber-600" />;
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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
      {winner && winner.total > 0 && (
        <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-4">
              <Crown className="w-8 h-8 text-yellow-500" />
              <div className="text-center">
                <h2 className="text-2xl font-bold text-yellow-700">🏆 Winner!</h2>
                <p className="text-xl font-semibold">{winner.player_name}</p>
                <p className="text-lg text-muted-foreground">
                  Total Strokes: {winner.total}
                </p>
              </div>
              <Crown className="w-8 h-8 text-yellow-500" />
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
                  index === 0 ? 'border-yellow-200 bg-yellow-50' : 'border-border bg-background'
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
                <div className="text-right">
                  <div className="text-2xl font-bold">
                    {player.total > 0 ? player.total : 'DNF'}
                  </div>
                  <div className="text-sm text-muted-foreground">
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
                      index === 0 ? 'bg-yellow-50' : ''
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
                <CheckCircle className="w-4 h-4 mr-2" />
                {saving ? "Confirming..." : "Confirm Results"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-green-600">
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