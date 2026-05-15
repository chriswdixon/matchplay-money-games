import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, DollarSign, Medal } from 'lucide-react';
import { MatchResult, PlayerScore } from '@/hooks/useMatchScoring';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface MatchResultsDisplayProps {
  matchResult: MatchResult;
  playerScores: PlayerScore[];
  buyInAmount?: number;
  maxParticipants?: number;
  holePars?: { [hole: string]: number };
  inline?: boolean; // Indicates if displayed inline within a card
}

const getScoreColorClasses = (score: number | undefined, par: number | undefined) => {
  if (!score) return 'bg-muted text-muted-foreground';
  if (!par) return 'bg-primary/10 text-primary';
  if (score < par) return 'bg-success/15 text-success';
  if (score > par) return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-foreground';
};

export function MatchResultsDisplay({ matchResult, playerScores, buyInAmount = 0, maxParticipants, holePars, inline = false }: MatchResultsDisplayProps) {
  const isTestingMode = maxParticipants === 1;
  const isMobile = useIsMobile();
  
  // Sort players by net score (lowest to highest)
  const sortedPlayers = [...playerScores].sort((a, b) => a.net_total - b.net_total);
  
  // Pot is funded by the human's buy-in (bots in testing mode don't pay).
  // Real matches: pot = buy-in × number of players. Winner takes everything (split on tie).
  const totalPot = (buyInAmount / 100) * (isTestingMode ? 1 : playerScores.length);
  
  const payouts: { [playerId: string]: number } = {};
  if (totalPot > 0) {
    const winners = sortedPlayers.filter(p => p.net_total === sortedPlayers[0]?.net_total && p.total > 0);
    const share = winners.length > 0 ? totalPot / winners.length : 0;
    winners.forEach(w => { payouts[w.player_id] = share; });
  }

  const getPositionIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-warning" />;
    if (index === 1) return <Medal className="w-6 h-6 text-gray-400" />;
    if (index === 2) return <Medal className="w-6 h-6 text-warning" />;
    return null;
  };

  const getPositionBadge = (index: number) => {
    if (index === 0) return <Badge className="bg-warning hover:bg-warning/90">1st Place</Badge>;
    if (index === 1) return <Badge className="bg-gray-400 hover:bg-gray-500">2nd Place</Badge>;
    if (index === 2) return <Badge className="bg-warning/80 hover:bg-warning/90">3rd Place</Badge>;
    return <Badge variant="outline">{index + 1}th Place</Badge>;
  };

  return (
    <div className={cn(
      "space-y-6 py-6 w-full overflow-hidden",
      inline ? "px-2 md:px-4" : "px-4 md:px-6"
    )}>
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-8 h-8 text-warning" />
          <h2 className="text-3xl font-bold">Match Complete!</h2>
        </div>
        <p className="text-muted-foreground">Final Results</p>
      </div>

      {/* Podium Display */}
      <div className={cn(
        "flex flex-col md:flex-row flex-wrap justify-center items-stretch gap-4",
        !inline && "max-w-4xl mx-auto"
      )}>
        {sortedPlayers.slice(0, 3).map((player, index) => (
          <Card 
            key={player.player_id}
            className={`relative w-full md:w-72 ${index === 0 ? 'ring-2 ring-yellow-500' : ''}`}
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
                <div className="flex items-center justify-center gap-2 pt-2 border-t bg-success/10 rounded-lg p-2">
                  <span className="text-2xl font-bold text-success">
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
        <div className={cn(
          "space-y-2",
          !inline && "max-w-4xl mx-auto"
        )}>
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

      {/* Pot Summary */}
      {buyInAmount > 0 && (
        <Card className={cn(
          "bg-primary/5",
          !inline && "max-w-4xl mx-auto"
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-primary" />
                <span className="text-lg font-semibold">
                  {isTestingMode ? 'Solo Pot (Play Money)' : 'Total Pot'}
                </span>
              </div>
              <div className="text-3xl font-bold text-primary">
                ${totalPot.toFixed(0)}
              </div>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              {isTestingMode
                ? `Solo testing match vs 3 bot opponents — winner takes the buy-in back as play money.`
                : `Buy-in: $${(buyInAmount / 100).toFixed(0)} × ${playerScores.length} players`}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Testing Mode Notice */}
      {isTestingMode && (
        <Card className={cn(
          "bg-warning/10 border-warning/30",
          !inline && "max-w-4xl mx-auto"
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-center gap-2 text-warning">
              <Trophy className="w-6 h-6" />
              <span className="text-lg font-semibold">Solo Testing Match</span>
            </div>
            <div className="mt-2 text-center text-sm text-warning/80">
              You played against 3 bots that scored bogey (par + 1) on every hole. Beat them and the buy-in is credited back to your play-money balance.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Scorecard */}
      <Card className={cn(!inline && "max-w-4xl mx-auto")}>
        <CardHeader>
          <CardTitle className="font-bold">Detailed Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="front9" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="front9" className="font-bold">Front 9</TabsTrigger>
              <TabsTrigger value="back9" className="font-bold">Back 9</TabsTrigger>
            </TabsList>

            <TabsContent value="front9" className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-bold">Player</th>
                    {Array.from({ length: 9 }, (_, i) => (
                      <th key={i + 1} className="text-center p-2 font-bold w-10">{i + 1}</th>
                    ))}
                    <th className="text-center p-2 font-bold">F9</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player, index) => (
                    <tr
                      key={`${player.player_id}-f9`}
                      className={`border-b ${index === 0 ? 'bg-warning/10' : ''}`}
                    >
                      <td className="p-2 font-medium">
                        <div className="flex items-center gap-2">
                          {getPositionIcon(index)}
                          <span className="text-xs lg:text-sm">{player.player_name}</span>
                        </div>
                      </td>
                      {Array.from({ length: 9 }, (_, i) => {
                        const hole = i + 1;
                        const score = player.scores[hole];
                        return (
                          <td key={hole} className="text-center p-1">
                            <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-medium ${getScoreColorClasses(score, holePars?.[hole])}`}>
                              {score || '-'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-center p-2 font-bold">{player.front9 || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>

            <TabsContent value="back9" className="mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-bold">Player</th>
                    {Array.from({ length: 9 }, (_, i) => (
                      <th key={i + 10} className="text-center p-2 font-bold w-10">{i + 10}</th>
                    ))}
                    <th className="text-center p-2 font-bold">B9</th>
                    <th className="text-center p-2 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player, index) => (
                    <tr
                      key={`${player.player_id}-b9`}
                      className={`border-b ${index === 0 ? 'bg-warning/10' : ''}`}
                    >
                      <td className="p-2 font-medium">
                        <div className="flex items-center gap-2">
                          {getPositionIcon(index)}
                          <span className="text-xs lg:text-sm">{player.player_name}</span>
                        </div>
                      </td>
                      {Array.from({ length: 9 }, (_, i) => {
                        const hole = i + 10;
                        const score = player.scores[hole];
                        return (
                          <td key={hole} className="text-center p-1">
                            <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-medium ${getScoreColorClasses(score, holePars?.[hole])}`}>
                              {score || '-'}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-center p-2 font-bold">{player.back9 || '-'}</td>
                      <td className="text-center p-2 font-bold">{player.total > 0 ? player.total : 'DNF'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
