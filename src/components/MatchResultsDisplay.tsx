import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, DollarSign, Medal } from 'lucide-react';
import { MatchResult, PlayerScore } from '@/hooks/useMatchScoring';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MatchResultsDisplayProps {
  matchResult: MatchResult;
  playerScores: PlayerScore[];
  buyInAmount?: number;
  maxParticipants?: number;
}

export function MatchResultsDisplay({ matchResult, playerScores, buyInAmount = 0, maxParticipants }: MatchResultsDisplayProps) {
  const isTestingMode = maxParticipants === 1;
  const isMobile = useIsMobile();
  
  // Sort players by net score (lowest to highest)
  const sortedPlayers = [...playerScores].sort((a, b) => a.net_total - b.net_total);
  
  // Calculate payouts only if not testing mode
  const totalPot = !isTestingMode ? (buyInAmount / 100) * playerScores.length : 0;
  
  // Winner takes 60%, second place 30%, third place 10%
  const payouts: { [playerId: string]: number } = {};
  if (!isTestingMode) {
    if (sortedPlayers.length >= 1) {
      payouts[sortedPlayers[0].player_id] = totalPot * 0.6;
    }
    if (sortedPlayers.length >= 2) {
      payouts[sortedPlayers[1].player_id] = totalPot * 0.3;
    }
    if (sortedPlayers.length >= 3) {
      payouts[sortedPlayers[2].player_id] = totalPot * 0.1;
    }
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
              <div className="text-center space-y-1">
                <div className="text-5xl font-bold text-primary">{player.net_total}</div>
                <div className="text-sm text-muted-foreground font-semibold">Net Score</div>
                <div className="text-2xl text-muted-foreground">({player.total})</div>
                <div className="text-xs text-muted-foreground">Gross Score</div>
              </div>
              
              <div className="text-center py-2 bg-muted/50 rounded-lg">
                <div className="text-sm text-muted-foreground">Handicap: {player.handicap_index.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Course Handicap: {player.course_handicap}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t">
                <div>
                  <div className="text-xl font-semibold">{player.net_front9}</div>
                  <div className="text-xs text-muted-foreground">Net F9</div>
                  <div className="text-sm text-muted-foreground">({player.front9})</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">{player.net_back9}</div>
                  <div className="text-xs text-muted-foreground">Net B9</div>
                  <div className="text-sm text-muted-foreground">({player.back9})</div>
                </div>
              </div>

              {payouts[player.player_id] && (
                <div className="flex items-center justify-center gap-2 pt-2 border-t bg-green-50 dark:bg-green-950 rounded-lg p-2">
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
                  <div className="text-right space-y-1">
                    <div className="text-2xl font-bold text-primary">{player.net_total}</div>
                    <div className="text-xs text-muted-foreground">Net ({player.total} gross)</div>
                    <div className="text-xs text-muted-foreground">
                      HCP: {player.handicap_index.toFixed(1)} / CH: {player.course_handicap}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pot Summary - Hide in testing mode */}
      {!isTestingMode && buyInAmount > 0 && (
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

      {/* Testing Mode Notice */}
      {isTestingMode && (
        <Card className="max-w-4xl mx-auto bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
              <Trophy className="w-6 h-6" />
              <span className="text-lg font-semibold">Testing Mode - No Payouts Processed</span>
            </div>
            <div className="mt-2 text-center text-sm text-amber-600/80 dark:text-amber-400/80">
              This match was created in testing mode (1 player). Results are recorded but no money transactions occurred.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Scorecard */}
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Detailed Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            // Mobile: Vertical layout with tabs for Front 9 / Back 9
            <Tabs defaultValue="front9" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="front9">Front 9</TabsTrigger>
                <TabsTrigger value="back9">Back 9</TabsTrigger>
              </TabsList>
              
              <TabsContent value="front9" className="space-y-4 mt-4">
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = i + 1;
                  return (
                    <div key={hole} className="border rounded-lg p-3 space-y-2">
                      <div className="font-semibold text-sm text-muted-foreground mb-2">
                        Hole {hole}
                      </div>
                      <div className="space-y-2">
                        {sortedPlayers.map((player, index) => {
                          const score = player.scores[hole];
                          return (
                            <div 
                              key={player.player_id}
                              className={`flex items-center justify-between p-2 rounded ${
                                index === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {index < 3 && getPositionIcon(index)}
                                <span className="text-sm font-medium truncate">
                                  {player.player_name}
                                </span>
                              </div>
                              <div className={`w-10 h-10 rounded flex items-center justify-center font-semibold ${
                                score ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                              }`}>
                                {score || '-'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
              
              <TabsContent value="back9" className="space-y-4 mt-4">
                {Array.from({ length: 9 }, (_, i) => {
                  const hole = i + 10;
                  return (
                    <div key={hole} className="border rounded-lg p-3 space-y-2">
                      <div className="font-semibold text-sm text-muted-foreground mb-2">
                        Hole {hole}
                      </div>
                      <div className="space-y-2">
                        {sortedPlayers.map((player, index) => {
                          const score = player.scores[hole];
                          return (
                            <div 
                              key={player.player_id}
                              className={`flex items-center justify-between p-2 rounded ${
                                index === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-muted/30'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {index < 3 && getPositionIcon(index)}
                                <span className="text-sm font-medium truncate">
                                  {player.player_name}
                                </span>
                              </div>
                              <div className={`w-10 h-10 rounded flex items-center justify-center font-semibold ${
                                score ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                              }`}>
                                {score || '-'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          ) : (
            // Desktop: Horizontal table layout
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Player</th>
                    {Array.from({ length: 18 }, (_, i) => (
                      <th key={i + 1} className="text-center p-2 font-medium w-10">
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
                        index === 0 ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''
                      }`}
                    >
                      <td className="p-2 font-medium">
                        <div className="flex items-center gap-2">
                          {getPositionIcon(index)}
                          <span className="text-xs lg:text-sm">{player.player_name}</span>
                        </div>
                      </td>
                      {Array.from({ length: 18 }, (_, i) => {
                        const hole = i + 1;
                        const score = player.scores[hole];

                        return (
                          <td key={hole} className="text-center p-1">
                            <div className={`w-7 h-7 rounded flex items-center justify-center text-xs ${
                              score ? 'bg-muted text-foreground font-medium' : 'text-muted-foreground'
                            }`}>
                              {score || '-'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-center p-2 font-bold">
                        {player.total > 0 ? player.total : 'DNF'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
