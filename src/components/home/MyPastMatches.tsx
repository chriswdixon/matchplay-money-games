import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Users, ArrowRight, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useMatches } from "@/hooks/useMatches";
import { useAuth } from "@/hooks/useAuth";
import { format as formatDate } from "date-fns";

const MyPastMatches = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { matches, loading } = useMatches();

  const pastMatches = useMemo(() => {
    if (!user) return [];
    return matches
      .filter(
        (m) =>
          (m.status === "completed" || m.status === "cancelled") &&
          (m.user_joined || m.created_by === user.id),
      )
      .sort(
        (a, b) =>
          new Date(b.scheduled_time).getTime() -
          new Date(a.scheduled_time).getTime(),
      )
      .slice(0, 20);
  }, [matches, user]);

  if (!user) return null;
  if (!loading && pastMatches.length === 0) return null;

  return (
    <section
      aria-labelledby="past-matches-heading"
      className="rounded-3xl bg-muted dark:bg-white text-foreground dark:text-slate-900 p-4 md:p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <h2
          id="past-matches-heading"
          className="text-lg font-bold flex items-center gap-2"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground shrink-0">
            <Trophy className="w-5 h-5" aria-hidden="true" />
          </span>
          Past Matches
        </h2>
      </div>

      <div className="space-y-2">
        {loading
          ? [1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))
          : pastMatches.map((m) => {
              const filled = m.participant_count ?? 0;
              const isWinner = m.winner_id === user.id;
              const isCancelled = m.status === "cancelled";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate(`/match/${m.id}`)}
                  className="w-full text-left flex items-center gap-3 bg-background/60 dark:bg-slate-100 hover:bg-background dark:hover:bg-slate-200 rounded-2xl px-3 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Open ${m.course_name} match`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold truncate text-sm">
                        {m.course_name}
                      </span>
                      {isWinner && (
                        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-warning text-primary-foreground">
                          <Trophy className="w-3 h-3 mr-0.5" /> Winner
                        </span>
                      )}
                      {isCancelled && (
                        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {formatDate(new Date(m.scheduled_time), "MMM d, yyyy")}
                      </span>
                      <span aria-hidden="true" className="opacity-60">•</span>
                      <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span>
                        {filled}/{m.max_participants}
                      </span>
                    </div>
                    {m.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{m.location}</span>
                      </div>
                    )}
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
      </div>
    </section>
  );
};

export default MyPastMatches;
