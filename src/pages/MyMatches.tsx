import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Target,
  Play,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { format as formatDate, isToday, isTomorrow, formatDistanceToNow } from "date-fns";
import { useMatches } from "@/hooks/useMatches";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import MatchPlayersList from "@/components/home/MatchPlayersList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const friendlyDate = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${formatDate(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow, ${formatDate(d, "h:mm a")}`;
  return formatDate(d, "EEE MMM d, h:mm a");
};

const statusBadge = (status: string, scheduled: string) => {
  if (status === "started") {
    return { label: "Live", className: "bg-success text-success-foreground" };
  }
  const diff = new Date(scheduled).getTime() - Date.now();
  if (diff <= 0) {
    return { label: "Starting now", className: "bg-warning text-warning-foreground" };
  }
  if (diff < 60 * 60 * 1000) {
    return { label: "Starts soon", className: "bg-warning text-warning-foreground" };
  }
  return { label: "Open", className: "bg-primary text-primary-foreground" };
};

const MyMatches = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { matches, loading, leaveMatch } = useMatches();
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const myMatches = useMemo(() => {
    if (!user) return [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return matches
      .filter(
        (m) =>
          (m.status === "open" || m.status === "started") &&
          (m.user_joined || m.created_by === user.id) &&
          new Date(m.scheduled_time).getTime() >= cutoff,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_time).getTime() -
          new Date(b.scheduled_time).getTime(),
      );
  }, [matches, user]);

  const handleLeave = async () => {
    if (!leaveTarget) return;
    setLeaving(true);
    await leaveMatch(leaveTarget);
    setLeaving(false);
    setLeaveTarget(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-3 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Back"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-success text-white">
              <Target className="w-4 h-4" aria-hidden="true" />
            </span>
            My Active Matches
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 py-4 space-y-3">
        {loading && myMatches.length === 0 ? (
          [1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))
        ) : myMatches.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <p className="text-muted-foreground">
              You don't have any active matches.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => navigate("/create-match")}>
                Create Match
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/?tab=matches")}
              >
                Find Matches
              </Button>
            </div>
          </div>
        ) : (
          myMatches.map((m) => {
            const filled = m.participant_count ?? 0;
            const badge = statusBadge(m.status, m.scheduled_time);
            const isLive = m.status === "started";
            const isCreator = m.created_by === user?.id;
            const startsIn = formatDistanceToNow(new Date(m.scheduled_time), {
              addSuffix: true,
            });
            return (
              <article
                key={m.id}
                className="bg-card text-card-foreground rounded-2xl border-2 border-primary p-4 shadow-card space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold truncate">{m.course_name}</h2>
                    {m.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{m.location}</span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{friendlyDate(m.scheduled_time)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {filled}/{m.max_participants} players
                    </span>
                  </div>
                  <div className="col-span-2 text-[11px]">
                    {isLive ? "In progress" : `Starts ${startsIn}`}
                    {isCreator && (
                      <span className="ml-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                        Host
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/match/${m.id}`)}
                    className="gap-1.5"
                  >
                    {isLive ? (
                      <>
                        <Play className="w-3.5 h-3.5" /> Continue
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </>
                    )}
                  </Button>
                  {!isCreator && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLeaveTarget(m.id)}
                      className="gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Leave Match
                    </Button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </main>

      <AlertDialog
        open={!!leaveTarget}
        onOpenChange={(open) => !open && setLeaveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this match?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be removed from the match. You can rejoin while it's still
              open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} disabled={leaving}>
              {leaving ? "Leaving…" : "Leave Match"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyMatches;
