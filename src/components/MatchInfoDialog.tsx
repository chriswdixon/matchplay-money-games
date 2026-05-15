import { Suspense, lazy } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Trophy, DollarSign, Users } from "lucide-react";
import { format } from "date-fns";
import { useMatchScoring } from "@/hooks/useMatchScoring";

const MatchResultsDisplay = lazy(() =>
  import("./MatchResultsDisplay").then((m) => ({ default: m.MatchResultsDisplay })),
);

interface MatchInfoDialogProps {
  matchId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatLabel = (f?: string) => {
  const map: Record<string, string> = {
    "stroke-play": "Stroke Play",
    "match-play": "Match Play",
    "best-ball": "Best Ball",
    scramble: "Scramble",
  };
  return f ? map[f] || f : "";
};

export function MatchInfoDialog({ matchId, open, onOpenChange }: MatchInfoDialogProps) {
  const { matchData, playerScores, matchResult, loading } = useMatchScoring(matchId || "");

  const tee = matchData?.scheduled_time ? new Date(matchData.scheduled_time) : null;
  const buyIn = (matchData?.buy_in_amount ?? 0) / 100;
  const playerCount = playerScores.length || matchData?.participant_count || 0;
  const totalPot = buyIn * playerCount;
  const isCompleted = matchData?.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        <div className="p-5 space-y-4">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-xl">
              {matchData?.course_name || "Match details"}
            </DialogTitle>
            {matchData?.location && (
              <DialogDescription className="flex items-center gap-1 text-xs">
                <MapPin className="w-3 h-3" aria-hidden="true" />
                {matchData.location}
              </DialogDescription>
            )}
          </DialogHeader>

          {loading || !matchData ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {matchData.format && (
                  <Badge variant="outline">{formatLabel(matchData.format)}</Badge>
                )}
                {matchData.status && (
                  <Badge
                    className={
                      matchData.status === "completed"
                        ? "bg-success/15 text-success border-success/30"
                        : matchData.status === "cancelled"
                          ? "bg-destructive/15 text-destructive border-destructive/30"
                          : "bg-primary/15 text-primary border-primary/30"
                    }
                  >
                    {matchData.status.charAt(0).toUpperCase() + matchData.status.slice(1)}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Tee time
                  </div>
                  {tee ? (
                    <>
                      <div className="text-sm font-semibold mt-1">{format(tee, "EEE, MMM d")}</div>
                      <div className="text-xs text-muted-foreground">{format(tee, "h:mm a")}</div>
                    </>
                  ) : (
                    <div className="text-sm font-semibold mt-1">—</div>
                  )}
                </div>
                <div className="rounded-xl border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Trophy className="w-3.5 h-3.5" aria-hidden="true" /> Holes
                  </div>
                  <div className="text-sm font-semibold mt-1">{matchData.holes} holes</div>
                  <div className="text-xs text-muted-foreground">{formatLabel(matchData.format)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <DollarSign className="w-3.5 h-3.5" aria-hidden="true" /> Entry
                  </div>
                  <div className="text-sm font-semibold mt-1">${buyIn.toFixed(0)}</div>
                  <div className="text-xs text-muted-foreground">Pot ${totalPot.toFixed(0)}</div>
                </div>
                <div className="rounded-xl border p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" /> Players
                  </div>
                  <div className="text-sm font-semibold mt-1">
                    {playerCount}
                    {matchData.max_participants ? `/${matchData.max_participants}` : ""}
                  </div>
                </div>
              </div>

              {isCompleted && matchResult && playerScores.length > 0 ? (
                <Suspense fallback={<Skeleton className="h-64 w-full" />}>
                  <MatchResultsDisplay
                    matchResult={matchResult}
                    playerScores={playerScores}
                    buyInAmount={matchData.buy_in_amount || 0}
                    maxParticipants={matchData.max_participants}
                    holePars={matchData.hole_pars}
                    matchId={matchId || undefined}
                    matchName={matchData?.course_name || "Match"}
                    inline
                  />
                </Suspense>
              ) : playerScores.length > 0 ? (
                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-semibold mb-3">Scorecard</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-1.5 font-medium">Player</th>
                          <th className="text-center p-1.5 font-medium">Gross</th>
                          <th className="text-center p-1.5 font-medium">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...playerScores]
                          .sort((a, b) => a.net_total - b.net_total)
                          .map((p) => (
                            <tr key={p.player_id} className="border-b last:border-b-0">
                              <td className="p-1.5">{p.player_name}</td>
                              <td className="p-1.5 text-center">{p.total || "-"}</td>
                              <td className="p-1.5 text-center font-semibold">
                                {p.net_total || "-"}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No scores recorded yet.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MatchInfoDialog;
