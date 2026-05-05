import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Users, ArrowRight, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useMatches } from "@/hooks/useMatches";
import { useAuth } from "@/hooks/useAuth";
import { format as formatDate, isToday, isTomorrow } from "date-fns";

const friendlyDate = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${formatDate(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow, ${formatDate(d, "h:mm a")}`;
  return formatDate(d, "EEE MMM d, h:mm a");
};

const MyCurrentMatches = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { matches, loading } = useMatches();

  // "Current" = matches the user is part of (joined or created) that are
  // upcoming (open) or actively in progress (started). Excludes completed/cancelled.
  const myMatches = useMemo(() => {
    if (!user) return [];
    return matches
      .filter(
        (m) =>
          (m.status === "open" || m.status === "started") &&
          (m.user_joined || m.created_by === user.id),
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_time).getTime() -
          new Date(b.scheduled_time).getTime(),
      )
      .slice(0, 4);
  }, [matches, user]);

  // Hide entirely when there's nothing relevant to show (don't add empty noise)
  if (!user) return null;
  if (!loading && myMatches.length === 0) return null;

  return (
    <section
      aria-labelledby="current-matches-heading"
      className="rounded-3xl bg-muted dark:bg-white text-foreground dark:text-slate-900 p-4 md:p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <h2
          id="current-matches-heading"
          className="text-lg font-bold flex items-center gap-2"
        >
          <Target className="w-5 h-5 text-primary" aria-hidden="true" />
          Current Matches
        </h2>
        <button
          type="button"
          onClick={() => navigate("/?tab=matches")}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          aria-label="Find more matches"
          title="Find more matches"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-2">
        {loading
          ? [1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))
          : myMatches.map((m) => {
              const filled = m.participant_count ?? 0;
              const isLive = m.status === "started";
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => navigate(`/match/${m.id}`)}
                  className="w-full text-left flex items-center gap-3 bg-background/60 dark:bg-slate-100 hover:bg-background dark:hover:bg-slate-200 rounded-2xl px-3 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Open ${m.course_name} match`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold truncate text-sm">
                        {m.course_name}
                      </span>
                      {isLive && (
                        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-success text-success-foreground">
                          Live
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {friendlyDate(m.scheduled_time)}
                      </span>
                      <span aria-hidden="true" className="opacity-60">
                        •
                      </span>
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

export default MyCurrentMatches;
