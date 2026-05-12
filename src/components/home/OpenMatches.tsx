import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ArrowRight, Search, Navigation, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useMatches, type Match } from "@/hooks/useMatches";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "@/hooks/useLocation";
import { format as formatDate, isToday, isTomorrow } from "date-fns";

const INITIAL_RADIUS_MI = 30;
const RADIUS_STEP_MI = 30;
const MAX_RADIUS_MI = 25_000; // effectively unlimited

const friendlyDate = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return `Today, ${formatDate(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow, ${formatDate(d, "h:mm a")}`;
  return formatDate(d, "EEE MMM d, h:mm a");
};

const haversineMi = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const OpenMatches = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { matches, loading, joinMatch } = useMatches();
  const { location, requestLocation, loading: locationLoading } = useLocation();
  const [radius, setRadius] = useState<number>(INITIAL_RADIUS_MI);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const handleJoin = async (m: Match) => {
    const needsDialog =
      !!m.pin || (m.is_team_format && m.max_participants > 2);
    if (needsDialog) {
      navigate("/?tab=matches");
      return;
    }
    setJoiningId(m.id);
    try {
      const result = await joinMatch(m.id);
      if (!result?.error) navigate(`/match/${m.id}`);
    } finally {
      setJoiningId(null);
    }
  };

  const openMatches = useMemo(() => {
    if (!user) return [];
    const now = Date.now();
    const withDistance = matches
      .filter((m) => {
        if (m.status !== "open") return false;
        if (m.user_joined) return false;
        if (m.created_by === user.id) return false;
        if ((m.participant_count || 0) >= m.max_participants) return false;
        if (new Date(m.scheduled_time).getTime() < now) return false;
        return true;
      })
      .map((m) => {
        let distanceMi: number | undefined;
        if (typeof m.distance_km === "number") {
          distanceMi = m.distance_km * 0.621371;
        } else if (location && m.latitude && m.longitude) {
          distanceMi = haversineMi(
            location.latitude,
            location.longitude,
            m.latitude,
            m.longitude,
          );
        }
        return { match: m, distanceMi };
      });

    // If we have a location, filter by radius. Otherwise show all open matches.
    const filtered = location
      ? withDistance.filter(
          ({ distanceMi }) => distanceMi === undefined || distanceMi <= radius,
        )
      : withDistance;

    filtered.sort((a, b) => {
      const da = a.distanceMi ?? Number.POSITIVE_INFINITY;
      const db = b.distanceMi ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return (
        new Date(a.match.scheduled_time).getTime() -
        new Date(b.match.scheduled_time).getTime()
      );
    });

    return filtered.slice(0, 10);
  }, [matches, user, location, radius]);

  if (!user) return null;

  const canExpand = location && radius < MAX_RADIUS_MI;
  const isUnlimited = radius >= MAX_RADIUS_MI;

  const handleExpand = () => {
    if (radius < 90) setRadius(radius + RADIUS_STEP_MI);
    else if (radius < 200) setRadius(radius + 50);
    else setRadius(MAX_RADIUS_MI);
  };

  return (
    <section
      aria-labelledby="open-matches-heading"
      className="page-card-shell"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <h2
          id="open-matches-heading"
          className="text-lg font-bold flex items-center gap-2"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-success text-white shrink-0">
            <Search className="w-5 h-5" aria-hidden="true" />
          </span>
          Open Matches
        </h2>
        <button
          type="button"
          onClick={() => navigate("/?tab=matches")}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary !text-white hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          aria-label="Browse all matches"
          title="Browse all matches"
        >
          <ArrowRight className="w-4 h-4 text-white" aria-hidden="true" />
        </button>
      </div>

      {!location && (
        <div className="mb-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => requestLocation()}
            disabled={locationLoading}
          >
            {locationLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Navigation className="w-4 h-4 mr-2" aria-hidden="true" />
            )}
            Enable location to see matches near you
          </Button>
        </div>
      )}

      {location && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
          {isUnlimited
            ? "Showing matches anywhere"
            : `Showing matches within ${radius} miles`}
        </p>
      )}

      <div className="space-y-2">
        {loading ? (
          [1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))
        ) : openMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {location
              ? `No open matches within ${isUnlimited ? "any distance" : `${radius} miles`}.`
              : "No open matches found."}
          </p>
        ) : (
          openMatches.map(({ match: m, distanceMi }) => {
            const filled = m.participant_count ?? 0;
            return (
              <button
                key={m.id}
                type="button"
                disabled={joiningId === m.id}
                onClick={() => handleJoin(m)}
                className="w-full text-left flex items-center gap-3 bg-background/60 dark:bg-slate-100 hover:bg-background dark:hover:bg-slate-200 rounded-2xl px-3 py-3 border-2 border-success transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                aria-label={`Join ${m.course_name} match`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold truncate text-sm">
                      {m.course_name}
                    </span>
                    {distanceMi !== undefined && (
                      <span className="text-[10px] font-semibold text-primary shrink-0">
                        {distanceMi.toFixed(1)} mi
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {friendlyDate(m.scheduled_time)}
                    </span>
                    <span aria-hidden="true" className="opacity-60">•</span>
                    <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>
                      {filled}/{m.max_participants}
                    </span>
                    <span aria-hidden="true" className="opacity-60">•</span>
                    <span>${(m.buy_in_amount / 100).toFixed(0)}</span>
                  </div>
                  {m.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{m.location}</span>
                    </div>
                  )}
                </div>
                {joiningId === m.id ? (
                  <Loader2 className="w-4 h-4 text-success shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight
                    className="w-4 h-4 text-muted-foreground shrink-0"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      {canExpand && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-3"
          onClick={handleExpand}
        >
          Expand search radius
        </Button>
      )}
    </section>
  );
};

export default OpenMatches;
