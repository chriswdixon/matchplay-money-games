import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, DollarSign } from 'lucide-react';
import { PlayerScore } from '@/hooks/useMatchScoring';

interface ProjectedPayoutProps {
  playerScores: PlayerScore[];
  buyInAmount?: number;
  maxParticipants?: number;
  currentUserId?: string;
}

/**
 * Shows a projected leaderboard + payout breakdown to a player who has
 * already clicked Complete, while waiting for other players to finish.
 *
 * Mirrors the payout math in MatchResultsDisplay (winner-take-all, split on tie),
 * but operates on live (non-finalized) scores.
 */
export function ProjectedPayout({
  playerScores,
  buyInAmount = 0,
  maxParticipants,
  currentUserId,
}: ProjectedPayoutProps) {
  const isTestingMode = maxParticipants === 1;

  const sorted = [...playerScores].sort((a, b) => {
    if (a.net_total === 0 && b.net_total === 0) return 0;
    if (a.net_total === 0) return 1;
    if (b.net_total === 0) return -1;
    return a.net_total - b.net_total;
  });

  const buyInDollars = (buyInAmount || 0) / 100;
  const totalPot = buyInDollars * (isTestingMode ? 1 : playerScores.length);

  const payouts: Record<string, number> = {};
  if (totalPot > 0) {
    const leaderNet = sorted[0]?.net_total ?? 0;
    const winners = sorted.filter((p) => p.total > 0 && p.net_total === leaderNet);
    const share = winners.length > 0 ? totalPot / winners.length : 0;
    winners.forEach((w) => {
      payouts[w.player_id] = share;
    });
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          Projected Payout
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Based on current scores. Final results lock in once every player clicks Complete.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {totalPot > 0 && (
          <div className="flex items-center justify-between text-sm pb-2 border-b">
            <span className="text-muted-foreground">Total pot</span>
            <span className="font-semibold">${Math.round(totalPot)}</span>
          </div>
        )}

        {sorted.map((player, index) => {
          const isYou = player.player_id === currentUserId;
          const projected = payouts[player.player_id] || 0;
          const isWinner = projected > 0;
          return (
            <div
              key={player.player_id}
              className={`flex items-center justify-between p-2 rounded-md ${
                isWinner ? 'bg-warning/10 border border-warning/30' : 'bg-muted/30'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold w-5 text-center text-muted-foreground">
                  {index + 1}
                </span>
                {isWinner && <Trophy className="w-4 h-4 text-warning shrink-0" />}
                <span className="text-sm font-medium truncate">{player.player_name}</span>
                {isYou && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    You
                  </Badge>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold">
                  {player.total > 0 ? `Net ${player.net_total}` : 'DNF'}
                </div>
                {totalPot > 0 && (
                  <div className={`text-xs ${isWinner ? 'text-warning font-semibold' : 'text-muted-foreground'}`}>
                    {isWinner ? `+$${Math.round(projected)}` : '—'}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <p className="text-[11px] text-muted-foreground pt-1">
          Ties at the top split the pot evenly. Players who haven't entered scores show as DNF.
        </p>
      </CardContent>
    </Card>
  );
}
