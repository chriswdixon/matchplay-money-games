import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidersHorizontal, MapPin, X } from "lucide-react";
import { useMatches, type Match } from "@/hooks/useMatches";
import { useLocation } from "@/hooks/useLocation";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import JoinMatchConfirmDialog from "@/components/JoinMatchConfirmDialog";
import MatchDetailsSheet from "@/components/MatchDetailsSheet";

interface GamesNearYouProps {
  searchQuery?: string;
  onOpenFilters?: () => void;
  onClearSearch?: () => void;
  onPickSuggestion?: (value: string) => void;
}

const GamesNearYou = ({
  searchQuery = "",
  onOpenFilters,
  onClearSearch,
  onPickSuggestion,
}: GamesNearYouProps) => {
  const { user } = useAuth();
  const { matches, loading, joinMatch, refetch } = useMatches();
  const { location, formatDistance } = useLocation();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [confirmMatch, setConfirmMatch] = useState<Match | null>(null);
  const [detailsMatch, setDetailsMatch] = useState<Match | null>(null);

  useEffect(() => {
    refetch(location || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  // Realtime: refresh when ANY match or participant row changes (so counts update live)
  useEffect(() => {
    const channel = supabase
      .channel("games-near-you-public")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_participants" },
        () => {
          refetch(location || undefined);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        () => {
          refetch(location || undefined);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.latitude, location?.longitude]);

  const baseList = useMemo(() => {
    const now = new Date();
    return matches.filter((m) => {
      if (m.status === "completed" || m.status === "cancelled") return false;
      if (m.status === "open" && new Date(m.scheduled_time) < now) return false;
      if (m.user_joined) return false;
      return true;
    });
  }, [matches]);

  const visible = useMemo(() => {
    let list = baseList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          m.course_name.toLowerCase().includes(q) ||
          m.location.toLowerCase().includes(q) ||
          m.address?.toLowerCase().includes(q),
      );
    }
    list = [...list].sort(
      (a, b) =>
        new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime(),
    );
    return list.slice(0, 8);
  }, [baseList, searchQuery]);

  // Build suggestions from available matches' locations when current query has no hits
  const suggestions = useMemo(() => {
    const tokens = new Set<string>();
    baseList.forEach((m) => {
      if (m.location) tokens.add(m.location.split(",")[0].trim());
      if (m.address) {
        const zip = m.address.match(/\b\d{5}\b/);
        if (zip) tokens.add(zip[0]);
      }
    });
    return Array.from(tokens).slice(0, 5);
  }, [baseList]);

  const handleJoin = (matchId: string) => {
    if (!user) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    if (match.is_team_format && match.max_participants > 2) {
      toast.info("This is a team match. Open Find Matches to choose a team.");
      return;
    }
    if (match.pin) {
      toast.info("This match requires a PIN. Open Find Matches to enter it.");
      return;
    }

    setConfirmMatch(match);
  };

  const handleConfirmJoin = async () => {
    if (!confirmMatch) return;
    setJoiningId(confirmMatch.id);
    try {
      await joinMatch(confirmMatch.id);
    } finally {
      setJoiningId(null);
    }
  };

  const formatTime = (iso: string) => format(new Date(iso), "h:mm");

  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
    <section
      className="rounded-3xl bg-foreground text-background p-4 md:p-6 shadow-card"
      aria-labelledby="games-near-you"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-background/15">
        <h2 id="games-near-you" className="text-lg font-bold">
          Games Near You
        </h2>
        {onOpenFilters && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenFilters}
            className="text-background hover:bg-background/10 hover:text-background"
            aria-label="Open filters"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl bg-background/10" />
          ))
        ) : visible.length === 0 ? (
          <div className="py-6 text-center space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                {hasActiveSearch
                  ? `No matches for "${searchQuery}"`
                  : "No matches available right now."}
              </p>
              <p className="text-xs text-background/70">
                {hasActiveSearch
                  ? "Try one of these areas instead:"
                  : "Check back soon or widen your search radius."}
              </p>
            </div>

            {hasActiveSearch && suggestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onPickSuggestion?.(s)}
                    className="inline-flex items-center gap-1 bg-background/10 hover:bg-background/20 text-background rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  >
                    <MapPin className="w-3 h-3" aria-hidden="true" />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {hasActiveSearch && onClearSearch && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onClearSearch}
                className="rounded-full bg-background text-foreground hover:bg-background/90 h-9 px-5"
              >
                <X className="w-4 h-4 mr-1.5" aria-hidden="true" />
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          visible.map((m) => {
            const time = formatTime(m.scheduled_time);
            const distance = m.distance_km ? formatDistance(m.distance_km) : null;
            const isFull =
              (m.participant_count || 0) >= m.max_participants;
            return (
              <div
                key={m.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailsMatch(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailsMatch(m);
                  }
                }}
                className="flex items-center gap-3 bg-background/95 text-foreground rounded-2xl px-4 py-3 cursor-pointer hover:bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="text-base md:text-lg font-bold truncate leading-tight">
                    {m.course_name}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="text-accent font-bold">{time}</span>
                    {distance && (
                      <>
                        <span aria-hidden="true" className="opacity-60">•</span>
                        <span>{distance}</span>
                      </>
                    )}
                    <span aria-hidden="true" className="opacity-60">•</span>
                    <span className="font-medium">
                      {m.participant_count || 0}/{m.max_participants} players
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  disabled={isFull || joiningId === m.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleJoin(m.id);
                  }}
                  className="bg-primary text-primary-foreground hover:opacity-90 rounded-full h-10 px-6 font-bold tracking-wide shrink-0 shadow-accent"
                >
                  {isFull ? "FULL" : joiningId === m.id ? "..." : "JOIN"}
                </Button>
              </div>
            );
          })
        )}
      </div>

      <JoinMatchConfirmDialog
        open={!!confirmMatch}
        onOpenChange={(o) => !o && setConfirmMatch(null)}
        match={confirmMatch}
        onConfirm={handleConfirmJoin}
      />

      <MatchDetailsSheet
        open={!!detailsMatch}
        onOpenChange={(o) => !o && setDetailsMatch(null)}
        match={detailsMatch}
        joining={joiningId === detailsMatch?.id}
        onJoin={(m) => {
          setDetailsMatch(null);
          handleJoin(m.id);
        }}
      />
    </section>
  );
};

export default GamesNearYou;
