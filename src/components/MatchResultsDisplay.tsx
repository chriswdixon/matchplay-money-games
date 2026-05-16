import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, DollarSign, Medal, Star } from 'lucide-react';
import { MatchResult, PlayerScore } from '@/hooks/useMatchScoring';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { usePlayerRatings, RateablePlayer } from '@/hooks/usePlayerRatings';
import PlayerRatingDialog from './PlayerRatingDialog';

interface MatchResultsDisplayProps {
  matchResult: MatchResult;
  playerScores: PlayerScore[];
  buyInAmount?: number;
  maxParticipants?: number;
  holePars?: { [hole: string]: number };
  inline?: boolean;
  matchId?: string;
  matchName?: string;
}

const getScoreColorClasses = (score: number | undefined, par: number | undefined) => {
  if (!score) return 'bg-muted text-muted-foreground';
  if (!par) return 'bg-primary/10 text-primary';
  if (score < par) return 'bg-success/15 text-success';
  if (score > par) return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-foreground';
};

export function MatchResultsDisplay({ matchResult, playerScores, buyInAmount = 0, maxParticipants, holePars, inline = false, matchId, matchName }: MatchResultsDisplayProps) {
  const isTestingMode = maxParticipants === 1;
  const isMobile = useIsMobile();

  const { getRateablePlayersForMatch } = usePlayerRatings();
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [rateablePlayers, setRateablePlayers] = useState<RateablePlayer[]>([]);
  const [autoPrompted, setAutoPrompted] = useState(false);

  const unratedPlayers = rateablePlayers.filter((p) => !p.already_rated);
  const ratedPlayers = rateablePlayers.filter((p) => p.already_rated);

  useEffect(() => {
    if (!matchId) return;
    const fetchPlayers = async () => {
      const players = await getRateablePlayersForMatch(matchId);
      setRateablePlayers(players);
      const unrated = players.filter((p) => !p.already_rated);
      if (!autoPrompted && unrated.length > 0 && matchId) {
        const key = `tyche-rating-prompted-${matchId}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1');
          setShowRatingDialog(true);
        }
        setAutoPrompted(true);
      }
    };
    fetchPlayers();
  }, [matchId, getRateablePlayersForMatch, autoPrompted]);

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
      "space-y-4 sm:space-y-6 py-4 sm:py-6 w-full overflow-hidden",
      inline ? "px-2 sm:px-3 md:px-4" : "px-3 sm:px-4 md:px-6"
    )}>
      <div className="text-center space-y-1 sm:space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-warning" />
          <h2 className="text-2xl sm:text-3xl font-bold">Match Complete!</h2>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">Final Results</p>
      </div>

      {/* Podium Display */}
      <div className={cn(
        "flex flex-col md:flex-row flex-wrap justify-center items-stretch gap-3 sm:gap-4",
        !inline && "max-w-4xl mx-auto"
      )}>
        {sortedPlayers.slice(0, 3).map((player, index) => (
          <Card
            key={player.player_id}
            className={`relative w-full md:w-72 ${index === 0 ? 'ring-2 ring-yellow-500' : ''}`}
          >
            <CardHeader className="text-center pb-2 px-3 sm:px-6">
              <div className="flex justify-center mb-2">
                {getPositionIcon(index)}
              </div>
              <CardTitle className="text-lg sm:text-xl break-words">{player.player_name}</CardTitle>
              {getPositionBadge(index)}
            </CardHeader>
            <CardContent className="space-y-3 px-3 sm:px-6">
              <div className="text-center space-y-1">
                <div className="text-4xl sm:text-5xl font-bold text-primary leading-none">{player.net_total}</div>
                <div className="text-xs sm:text-sm text-muted-foreground font-semibold">Net Score</div>
                <div className="text-xl sm:text-2xl text-muted-foreground">({player.total})</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">Gross Score</div>
              </div>

              <div className="text-center py-2 bg-muted/50 rounded-lg">
                <div className="text-xs sm:text-sm text-muted-foreground">Handicap: {player.handicap_index.toFixed(1)}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">Course Handicap: {player.course_handicap}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t">
                <div>
                  <div className="text-lg sm:text-xl font-semibold">{player.net_front9}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Net F9</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">({player.front9})</div>
                </div>
                <div>
                  <div className="text-lg sm:text-xl font-semibold">{player.net_back9}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Net B9</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">({player.back9})</div>
                </div>
              </div>

              {payouts[player.player_id] && (
                <div className="flex items-center justify-center gap-2 pt-2 border-t bg-success/10 rounded-lg p-2">
                  <span className="text-xl sm:text-2xl font-bold text-success">
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
          <h3 className="text-fluid-lg font-semibold px-2">Other Finishers</h3>
          {sortedPlayers.slice(3).map((player, index) => (
            <Card key={player.player_id}>
              <CardContent className="flex items-center justify-between gap-3 p-3 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  {getPositionBadge(index + 3)}
                  <span className="match-card-title">{player.player_name}</span>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  <div className="match-card-stat text-primary">{player.net_total}</div>
                  <div className="match-card-meta whitespace-nowrap">Net ({player.total} gross)</div>
                  <div className="match-card-meta whitespace-nowrap">
                    HCP {player.handicap_index.toFixed(1)} / CH {player.course_handicap}
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
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
                <span className="text-base sm:text-lg font-semibold truncate">
                  {isTestingMode ? 'Solo Pot' : 'Total Pot'}
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-primary shrink-0">
                ${totalPot.toFixed(0)}
              </div>
            </div>
            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground">
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
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-center gap-2 text-warning">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-base sm:text-lg font-semibold">Solo Testing Match</span>
            </div>
            <div className="mt-2 text-center text-xs sm:text-sm text-warning/80">
              You played against 3 bots that scored bogey (par + 1) on every hole. Beat them and the buy-in is credited back to your play-money balance.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Scorecard */}
      <Card className={cn(!inline && "max-w-4xl mx-auto")}>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-bold text-base sm:text-lg">Detailed Scorecard</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <Tabs defaultValue="front9" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="front9" className="font-bold">Front 9</TabsTrigger>
              <TabsTrigger value="back9" className="font-bold">Back 9</TabsTrigger>
            </TabsList>

            <TabsContent value="front9" className="mt-4">
              <div className="table-scroll-wrap">
                <table className="table-responsive min-w-[480px]">
                  <thead>
                    <tr className="border-b">
                      <th className="col-player font-bold">Player</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 1} className="text-center font-bold w-8 sm:w-10">{i + 1}</th>
                      ))}
                      <th className="text-center font-bold">F9</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((player, index) => (
                      <tr
                        key={`${player.player_id}-f9`}
                        className={`border-b ${index === 0 ? 'bg-warning/10' : ''}`}
                      >
                        <td className="col-player font-medium">
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                            {getPositionIcon(index)}
                            <span className="truncate">{player.player_name}</span>
                          </div>
                        </td>
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 1;
                          const score = player.scores[hole];
                          return (
                            <td key={hole} className="text-center">
                              <div className={`w-6 h-6 sm:w-7 sm:h-7 mx-auto rounded flex items-center justify-center text-fluid-xs font-medium ${getScoreColorClasses(score, holePars?.[hole])}`}>
                                {score || '-'}
                              </div>
                            </td>
                          );
                        })}
                        <td className="text-center font-bold">{player.front9 || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="back9" className="mt-4">
              <div className="table-scroll-wrap">
                <table className="table-responsive min-w-[520px]">
                  <thead>
                    <tr className="border-b">
                      <th className="col-player font-bold">Player</th>
                      {Array.from({ length: 9 }, (_, i) => (
                        <th key={i + 10} className="text-center font-bold w-8 sm:w-10">{i + 10}</th>
                      ))}
                      <th className="text-center font-bold">B9</th>
                      <th className="text-center font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPlayers.map((player, index) => (
                      <tr
                        key={`${player.player_id}-b9`}
                        className={`border-b ${index === 0 ? 'bg-warning/10' : ''}`}
                      >
                        <td className="col-player font-medium">
                          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                            {getPositionIcon(index)}
                            <span className="truncate">{player.player_name}</span>
                          </div>
                        </td>
                        {Array.from({ length: 9 }, (_, i) => {
                          const hole = i + 10;
                          const score = player.scores[hole];
                          return (
                            <td key={hole} className="text-center">
                              <div className={`w-6 h-6 sm:w-7 sm:h-7 mx-auto rounded flex items-center justify-center text-fluid-xs font-medium ${getScoreColorClasses(score, holePars?.[hole])}`}>
                                {score || '-'}
                              </div>
                            </td>
                          );
                        })}
                        <td className="text-center font-bold">{player.back9 || '-'}</td>
                        <td className="text-center font-bold">{player.total > 0 ? player.total : 'DNF'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Player Rating Prompt — always visible to all match players */}
      {matchId && rateablePlayers.length > 0 && (
        <Card className={cn(!inline && "max-w-4xl mx-auto")}>
          <CardContent className="p-4 sm:p-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold">Rate Your Opponents</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {unratedPlayers.length > 0
                    ? `${unratedPlayers.length} of ${rateablePlayers.length} player${rateablePlayers.length > 1 ? 's' : ''} left to review`
                    : `You've reviewed all ${rateablePlayers.length} player${rateablePlayers.length > 1 ? 's' : ''}`}
                </p>
              </div>
              <Button onClick={() => setShowRatingDialog(true)} className="gap-2 w-full sm:w-auto shrink-0">
                <Star className="w-4 h-4" />
                {unratedPlayers.length > 0 ? 'Rate Players' : 'Edit Reviews'}
              </Button>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {rateablePlayers.map((p) => (
                <li
                  key={p.user_id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                >
                  <span className="text-sm font-medium truncate">{p.display_name}</span>
                  {p.already_rated ? (
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      <Star className="w-3 h-3" /> Reviewed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">Pending</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {matchId && (
        <PlayerRatingDialog
          open={showRatingDialog}
          onOpenChange={(open) => {
            setShowRatingDialog(open);
            if (!open && matchId) {
              getRateablePlayersForMatch(matchId).then((players) => {
                setRateablePlayers(players);
              });
            }
          }}
          matchId={matchId}
          matchName={matchName || "Match"}
        />
      )}
    </div>
  );
}
