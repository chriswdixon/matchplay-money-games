import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Loader2, Plus, Navigation, Users, Trophy } from "lucide-react";
import { useGolfCourses, type GolfCourse } from "@/hooks/useGolfCourses";
import { useLocation } from "@/hooks/useLocation";
import { useMatches, type Match } from "@/hooks/useMatches";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import CourseDetailDialog from "./CourseDetailDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import LocationStatusBanner from "./LocationStatusBanner";
import MatchSearchFiltersBar, {
  DEFAULT_FILTERS,
  applyMatchFilters,
  compareBySort,
  isFilterActive,
  type MatchSearchFilters,
} from "./MatchSearchFiltersBar";

const DEFAULT_RADIUS_MI = 30;
// Slider position past the max means "Unlimited" — search anywhere.
const UNLIMITED_RADIUS_POS = 101;
const UNLIMITED_RADIUS_MI = 25_000; // > Earth's diameter in miles
const isUnlimited = (r: number) => r >= UNLIMITED_RADIUS_POS;
const effectiveRadius = (r: number) => (isUnlimited(r) ? UNLIMITED_RADIUS_MI : r);
const radiusLabel = (r: number) => (isUnlimited(r) ? "∞" : String(r));

const distanceMi = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

const NearbyCoursesWithMatches = () => {
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<GolfCourse[]>([]);
  const [searched, setSearched] = useState(false);
  const { searchCoursesByName, searchNearbyCourses, loading } = useGolfCourses();
  const { location, requestLocation, error: locationError, loading: locationLoading, geocodeAddress } = useLocation();
  const [manualLocation, setManualLocation] = useState<{ latitude: number; longitude: number; label: string } | null>(null);
  const effectiveLocation = location ?? manualLocation;
  const { matches, joinMatch } = useMatches();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [visibleCount, setVisibleCount] = useState(10);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<GolfCourse | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [radius, setRadius] = useState<number>(DEFAULT_RADIUS_MI);

  // Load 10 at a time on both mobile and desktop
  const getStep = () => 10;

  // Realtime auto-search: filter on every keystroke once we have GPS.
  // Realtime auto-search: filter on every keystroke once we have a location.
  useEffect(() => {
    if (!effectiveLocation) return;
    const handle = setTimeout(() => {
      runSearch(query);
    }, 80);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, effectiveLocation?.latitude, effectiveLocation?.longitude, radius]);

  // Reset pagination only when the result set size actually changes,
  // not on every new array reference from re-running the debounced search.
  useEffect(() => {
    setVisibleCount((c) => Math.min(Math.max(c, 10), Math.max(courses.length, 10)));
  }, [courses.length]);

  // Note: pagination is user-driven via the "Load more" button below.
  // Auto-loading via IntersectionObserver was removed because on desktop
  // the sentinel is often already in the viewport, which caused all results
  // to expand at once.

  const visibleCourses = courses.slice(0, visibleCount);

  // Only allow ZIP code searches (US 5-digit, optional +4) — city searches are not supported.
  const isZip = (s: string) => /^\d{5}(-\d{4})?$/.test(s.trim());

  const runSearch = async (q: string) => {
    const term = q.trim();

    // If the query is a ZIP and we have no GPS, geocode it as the search origin.
    if (term && isZip(term)) {
      const geo = await geocodeAddress(term);
      if (geo) {
        setManualLocation({ latitude: geo.latitude, longitude: geo.longitude, label: term });
        setSearched(true);
        const r = effectiveRadius(radius);
        const nearby = await searchNearbyCourses(geo.latitude, geo.longitude, r);
        const results = nearby
          .map((c) => ({
            ...c,
            distance:
              c.distance ??
              (c.latitude && c.longitude
                ? distanceMi(geo.latitude, geo.longitude, c.latitude, c.longitude)
                : undefined),
          }))
          .filter((c) => c.distance !== undefined && c.distance <= r)
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));
        setCourses(results);
        return;
      }
    }

    const origin = effectiveLocation;
    if (!origin) {
      await requestLocation();
      return;
    }
    setSearched(true);
    const lower = term.toLowerCase();

    const r = effectiveRadius(radius);
    // Always start from nearby courses within radius
    const nearby = await searchNearbyCourses(origin.latitude, origin.longitude, r);
    let results = nearby
      .map((c) => ({
        ...c,
        distance:
          c.distance ??
          (c.latitude && c.longitude
            ? distanceMi(origin.latitude, origin.longitude, c.latitude, c.longitude)
            : undefined),
      }))
      .filter((c) => c.distance !== undefined && c.distance <= r);

    if (lower.length >= 1) {
      const matchesPrefix = (name: string) => {
        const low = name.toLowerCase();
        if (low.startsWith(lower)) return true;
        return low.split(/[\s\-']+/).some((w) => w.startsWith(lower));
      };

      let matched = results.filter((c) => matchesPrefix(c.name));

      if (matched.length === 0 && lower.length >= 3) {
        // Explicit course-name search: ignore the radius filter so we surface
        // matching courses anywhere in the country. If the full query returns
        // nothing (e.g. user typed extra descriptive words like "drive"),
        // progressively drop trailing tokens until we find something.
        const tokens = lower.split(/\s+/).filter(Boolean);
        let named: GolfCourse[] = [];
        for (let n = tokens.length; n >= 1; n--) {
          const term = tokens.slice(0, n).join(" ");
          if (term.length < 3) break;
          named = await searchCoursesByName(term);
          if (named.length > 0) break;
        }
        matched = named.map((c) => ({
          ...c,
          distance:
            c.distance ??
            (c.latitude && c.longitude
              ? distanceMi(origin.latitude, origin.longitude, c.latitude, c.longitude)
              : undefined),
        }));
      }
      results = matched;
    }

    results.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    setCourses(results);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  // Group open matches by course name with fuzzy token-overlap matching so
  // legacy free-form names (e.g. "Harbor Lakes Drive") still associate with
  // the canonical course ("Harbor Lakes Golf Club").
  const normalizeTokens = (s: string): Set<string> => {
    const stop = new Set(["golf", "club", "course", "the", "at", "of", "and", "links", "country", "cc", "gc"]);
    return new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length >= 2 && !stop.has(t)),
    );
  };
  const namesMatch = (a: string, b: string): boolean => {
    const ka = a.toLowerCase().trim();
    const kb = b.toLowerCase().trim();
    if (ka === kb) return true;
    const ta = normalizeTokens(a);
    const tb = normalizeTokens(b);
    if (ta.size === 0 || tb.size === 0) return false;
    let shared = 0;
    ta.forEach((t) => { if (tb.has(t)) shared++; });
    // Require at least 2 shared significant tokens, or all tokens of the
    // shorter name to be present in the longer one.
    const smaller = Math.min(ta.size, tb.size);
    return shared >= 2 || (smaller > 0 && shared === smaller);
  };

  const openMatchesForCourse = useMemo(() => {
    const now = new Date();
    const open = matches.filter(
      (m) =>
        m.status === "open" &&
        new Date(m.scheduled_time) >= now &&
        (m.participant_count || 0) < m.max_participants,
    );
    return (courseName: string) => open.filter((m) => namesMatch(m.course_name, courseName));
  }, [matches]);


  const handleCreateAtCourse = (course: GolfCourse) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const prefilledCourse = {
      name: course.name,
      address: course.address,
      latitude: course.latitude,
      longitude: course.longitude,
      website: course.website,
      externalId: course.externalId,
      booking_url: course.website,
    };
    try {
      sessionStorage.setItem("tyche-prefilled-course", JSON.stringify(prefilledCourse));
    } catch {}
    navigate("/create-match", { state: { prefilledCourse } });
  };

  const handleJoinMatch = async (match: Match) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    // Already a participant — just open the scorecard.
    if (match.user_joined) {
      navigate(`/match/${match.id}`);
      return;
    }
    // PIN-protected or multi-team matches require the dedicated join dialog
    // on the matches tab (PIN entry / team selection).
    const needsDialog =
      !!match.pin || (match.is_team_format && match.max_participants > 2);
    if (needsDialog) {
      navigate("/?tab=matches");
      return;
    }
    setJoiningId(match.id);
    try {
      const result = await joinMatch(match.id);
      if (!result?.error) {
        navigate(`/match/${match.id}`);
      }
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search course or ZIP code"
            className="pl-10 h-11 rounded-full bg-success text-white font-bold placeholder:text-white/80 placeholder:font-bold border-success focus-visible:ring-success"
            aria-label="Search courses or ZIP code to find nearby matches"
            inputMode="search"
            maxLength={60}
          />
        </div>
        {loading && (
          <div className="flex items-center px-2" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </form>

      {!effectiveLocation && (
        <>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => requestLocation()}
            disabled={locationLoading}
          >
            {locationLoading ? "Locating…" : "Enable location to see nearby courses"}
          </Button>
          <p className="text-xs text-muted-foreground text-center px-1">
            Or type a <span className="font-semibold">ZIP code</span> in the search above to find nearby matches without GPS.
          </p>
          <LocationStatusBanner
            error={locationError}
            loading={locationLoading}
            onRetry={() => requestLocation()}
          />
        </>
      )}

      {!location && manualLocation && (
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground" aria-live="polite">
          <span className="flex items-center gap-1 min-w-0 truncate">
            <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
            Searching near <span className="font-semibold text-foreground truncate">{manualLocation.label}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setManualLocation(null);
              setCourses([]);
              setSearched(false);
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {location && (
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1 flex-1 min-w-0" aria-live="polite">
            <MapPin className="w-3 h-3 inline shrink-0" aria-hidden="true" />
            Showing courses within
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1"
                  aria-label={`Adjust search radius, currently ${isUnlimited(radius) ? 'unlimited' : `${radius} miles`}`}
                >
                  {radiusLabel(radius)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Search radius</span>
                    <span className="text-sm text-muted-foreground">
                      {isUnlimited(radius) ? 'Unlimited' : `${radius} mi`}
                    </span>
                  </div>
                  <Slider
                    value={[radius]}
                    onValueChange={(v) => setRadius(v[0])}
                    min={1}
                    max={UNLIMITED_RADIUS_POS}
                    step={1}
                    aria-label="Search radius in miles"
                  />
                </div>
              </PopoverContent>
            </Popover>
            {isUnlimited(radius) ? '' : 'miles'}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 h-8 px-3 rounded-full"
            onClick={async () => {
              await requestLocation();
              await runSearch(query);
            }}
            disabled={locationLoading}
            aria-label="Use my current location and refresh nearby courses"
          >
            {locationLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span className="ml-1.5 text-xs font-medium">Use my location</span>
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {loading && courses.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Searching nearby courses...</p>
        )}
        {!loading && searched && courses.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No courses found nearby. Try a different search.
          </p>
        )}
        {visibleCourses.map((course, i) => {
          const openMatches = openMatchesForCourse(course.name);
          const hasOpenMatch = openMatches.length > 0;
          const openCourse = () => {
            setSelectedCourse(course);
            setDialogOpen(true);
          };
          return (
            <Card
              key={`${course.name}-${i}`}
              className="bg-card cursor-pointer hover:bg-accent/50 transition-colors border-success"
              onClick={openCourse}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openCourse();
                }
              }}
            >
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{course.name}</p>
                    {hasOpenMatch && (
                      <Badge variant="secondary" className="gap-1 shrink-0 text-xs">
                        <Trophy className="w-3 h-3" />
                        {openMatches.length} open
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{course.address}</span>
                    {course.distance !== undefined && (
                      <span className="text-primary shrink-0">
                        • {course.distance.toFixed(1)}mi
                      </span>
                    )}
                  </p>
                  {hasOpenMatch && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Users className="w-3 h-3" aria-hidden="true" />
                      {openMatches[0].participant_count || 0}/{openMatches[0].max_participants}{" "}
                      players • ${(openMatches[0].buy_in_amount / 100).toFixed(0)} buy-in
                    </p>
                  )}
                </div>
                {hasOpenMatch ? (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      disabled={joiningId === openMatches[0].id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleJoinMatch(openMatches[0]);
                      }}
                      className="bg-success text-white font-bold hover:bg-success hover:shadow-[0_0_20px_hsl(var(--success)/0.7)] transition-shadow"
                    >
                      {joiningId === openMatches[0].id
                        ? "Joining…"
                        : openMatches[0].user_joined
                          ? "Open Match"
                          : "Join Match"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCreateAtCourse(course);
                      }}
                    >
                      Create New
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleCreateAtCourse(course);
                    }}
                    className="shrink-0 bg-success text-white font-bold dark:text-white dark:font-bold hover:bg-success hover:shadow-[0_0_20px_hsl(var(--success)/0.7)] transition-shadow"
                  >
                    Create Match
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {visibleCount < courses.length && (
          <div ref={sentinelRef} className="py-3 flex flex-col items-center gap-2" aria-live="polite">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((c) => Math.min(c + getStep(), courses.length))}
            >
              Load more ({courses.length - visibleCount} remaining)
            </Button>
          </div>
        )}
      </div>

      <CourseDetailDialog
        course={selectedCourse}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        openMatches={
          selectedCourse
            ? openMatchesForCourse(selectedCourse.name).map((m) => ({
                id: m.id,
                participant_count: m.participant_count,
                max_participants: m.max_participants,
                buy_in_amount: m.buy_in_amount,
                scheduled_time: m.scheduled_time,
                format: m.format,
              }))
            : []
        }
        onJoinMatch={(id) => {
          setDialogOpen(false);
          const m = matches.find((mm) => mm.id === id);
          if (m) handleJoinMatch(m);
          else navigate(`/match/${id}`);
        }}
        onCreateMatch={(c) => {
          setDialogOpen(false);
          handleCreateAtCourse(c);
        }}
      />
    </div>
  );
};

export default NearbyCoursesWithMatches;
