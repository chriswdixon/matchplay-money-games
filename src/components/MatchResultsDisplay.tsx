import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, DollarSign, Medal } from 'lucide-react';
import { MatchResult, PlayerScore } from '@/hooks/useMatchScoring';

interface MatchResultsDisplayProps {
  matchResult: MatchResult;
  playerScores: PlayerScore[];
  buyInAmount?: number;
}

export function MatchResultsDisplay({ matchResult, playerScores, buyInAmount = 0 }: MatchResultsDisplayProps) {
  // Sort players by score (lowest to highest)
  const sortedPlayers = [...playerScores].sort((a, b) => a.total - b.total);
  
  // Calculate payouts
  const totalPot = (buyInAmount / 100) * playerScores.length;
  
  // Winner takes 60%, second place 30%, third place 10%
  const payouts: { [playerId: string]: number } = {};
  if (sortedPlayers.length >= 1) {
    payouts[sortedPlayers[0].player_id] = totalPot * 0.6;
  }
  if (sortedPlayers.length >= 2) {
    payouts[sortedPlayers[1].player_id] = totalPot * 0.3;
  }
  if (sortedPlayers.length >= 3) {
    payouts[sortedPlayers[2].player_id] = totalPot * 0.1;
  }

  const getPositionIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (index === 1) return <Medal className="w-6 h-6 text-gray-400" />;
    if (index === 2) return <Medal className="w-6 h-6 text-amber-700" />;
    return null;
  };

  const getPositionBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-yellow-500 hover:bg-yellow-600">1st Place</Badge>;
    if (index === 1) return <Badge className="bg-gray-400 hover:bg-gray-500">2nd Place</Badge>;
    if (index === 2) return <Badge className="bg-amber-700 hover:bg-amber-800">3rd Place</Badge>;
    return <Badge variant="outline">{index + 1}th Place</Badge>;
  };

  return (
    <div className="space-y-6 px-4 md:px-6 py-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-8 h-8 text-yellow-500" />
          <h2 className="text-3xl font-bold">Match Complete!</h2>
        </div>
        <p className="text-muted-foreground">Final Results</p>
      </div>

      {/* Podium Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {sortedPlayers.slice(0, 3).map((player, index) => (
          <Card 
            key={player.player_id}
            className={`relative ${index === 0 ? 'md:col-start-2 ring-2 ring-yellow-500' : ''}`}
          >
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-2">
                {getPositionIcon(index)}
              </div>
              <CardTitle className="text-xl">{player.player_name}</CardTitle>
              {getPositionBadge(index)}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">{player.total}</div>
                <div className="text-sm text-muted-foreground">Total Strokes</div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t">
                <div>
                  <div className="text-xl font-semibold">{player.front9}</div>
                  <div className="text-xs text-muted-foreground">Front 9</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">{player.back9}</div>
                  <div className="text-xs text-muted-foreground">Back 9</div>
                </div>
              </div>

              {payouts[player.player_id] && (
                <div className="flex items-center justify-center gap-2 pt-2 border-t bg-green-50 dark:bg-green-950 rounded-lg p-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    ${payouts[player.player_id].toFixed(0)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Remaining Players */}
      {sortedPlayers.length > 3 && (
        <div className="space-y-2 max-w-4xl mx-auto">
          <h3 className="text-lg font-semibold px-2">Other Finishers</h3>
          {sortedPlayers.slice(3).map((player, index) => (
            <Card key={player.player_id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {getPositionBadge(index + 3)}
                  <span className="font-medium">{player.player_name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-primary">{player.total}</div>
                    <div className="text-xs text-muted-foreground">
                      F9: {player.front9} | B9: {player.back9}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pot Summary */}
      {buyInAmount > 0 && (
        <Card className="max-w-4xl mx-auto bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-primary" />
                <span className="text-lg font-semibold">Total Pot</span>
              </div>
              <div className="text-3xl font-bold text-primary">
                ${totalPot.toFixed(0)}
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Buy-in: ${(buyInAmount / 100).toFixed(0)} × {playerScores.length} players
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
