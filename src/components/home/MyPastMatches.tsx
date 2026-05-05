import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar, MapPin, Users, ArrowRight, Trophy, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useMatches } from "@/hooks/useMatches";
import { useAuth } from "@/hooks/useAuth";
import { format as formatDate } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

type StatusFilter = "all" | "completed" | "cancelled" | "won";
type RangeFilter = "all" | "30d" | "90d" | "1y";

const MyPastMatches = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { matches, loading } = useMatches();
  const isMobile = useIsMobile();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 3;

  const pastMatches = useMemo(() => {
    if (!user) return [];
    const now = Date.now();
    const rangeMs =
      rangeFilter === "30d"
        ? 30 * 86400000
        : rangeFilter === "90d"
        ? 90 * 86400000
        : rangeFilter === "1y"
        ? 365 * 86400000
        : Infinity;

    return matches
      .filter(
        (m) =>
          (m.status === "completed" || m.status === "cancelled") &&
          (m.user_joined || m.created_by === user.id),
      )
      .filter((m) => {
        if (statusFilter === "completed") return m.status === "completed";
        if (statusFilter === "cancelled") return m.status === "cancelled";
        if (statusFilter === "won") return m.winner_id === user.id;
        return true;
      })
      .filter((m) => {
        if (rangeMs === Infinity) return true;
        return now - new Date(m.scheduled_time).getTime() <= rangeMs;
      })
      .sort(
        (a, b) =>
          new Date(b.scheduled_time).getTime() -
          new Date(a.scheduled_time).getTime(),
      )
      .slice(0, 20);
  }, [matches, user, statusFilter, rangeFilter]);

  const totalPages = isMobile ? Math.max(1, Math.ceil(pastMatches.length / PAGE_SIZE)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const visibleMatches = useMemo(
    () =>
      isMobile
        ? pastMatches.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
        : pastMatches,
    [pastMatches, isMobile, safePage],
  );

  if (!user) return null;
  if (!loading && pastMatches.length === 0 && statusFilter === "all" && rangeFilter === "all") return null;

  const filtersActive = statusFilter !== "all" || rangeFilter !== "all";

  return (
    <section
      aria-labelledby="past-matches-heading"
      className="page-card-shell"
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="icon"
              className="relative bg-success text-success-foreground hover:bg-success/90"
              aria-label="Filter past matches"
            >
              <Filter className="w-4 h-4" aria-hidden="true" />
              {filtersActive && (
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="won">Won</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="cancelled">Cancelled</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Time range</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={rangeFilter}
              onValueChange={(v) => setRangeFilter(v as RangeFilter)}
            >
              <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="30d">Last 30 days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="90d">Last 90 days</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="1y">Last year</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        {loading ? (
          [1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))
        ) : visibleMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No matches match your filters.
          </p>
        ) : (
          visibleMatches.map((m) => {
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
          })
        )}
        {!loading && isMobile && pastMatches.length > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </Button>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: totalPages }).map((_, i) => (
                <span
                  key={i}
                  className={
                    i === safePage
                      ? "w-2 h-2 rounded-full bg-primary"
                      : "w-2 h-2 rounded-full bg-muted-foreground/30"
                  }
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              aria-label="Next page"
              className="h-8 w-8"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </section>
  );
};

export default MyPastMatches;
