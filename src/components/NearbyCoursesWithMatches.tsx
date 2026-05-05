import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Loader2, Plus, Navigation, Users, Trophy } from "lucide-react";
import { useGolfCourses, type GolfCourse } from "@/hooks/useGolfCourses";
import { useLocation } from "@/hooks/useLocation";
import { useMatches } from "@/hooks/useMatches";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import CourseDetailDialog from "./CourseDetailDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import LocationStatusBanner from "./LocationStatusBanner";

const DEFAULT_RADIUS_MI = 30;

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
  const { matches } = useMatches();
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

  // Infinite scroll: expand as the sentinel becomes visible
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => Math.min(c + getStep(), courses.length));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [courses.length, visibleCount]);

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
        const nearby = await searchNearbyCourses(geo.latitude, geo.longitude, radius);
        const results = nearby
          .map((c) => ({
            ...c,
            distance:
              c.distance ??
              (c.latitude && c.longitude
                ? distanceMi(geo.latitude, geo.longitude, c.latitude, c.longitude)
                : undefined),
          }))
          .filter((c) => c.distance !== undefined && c.distance <= radius)
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

    // Always start from nearby courses within radius
    const nearby = await searchNearbyCourses(origin.latitude, origin.longitude, radius);
    let results = nearby
      .map((c) => ({
        ...c,
        distance:
          c.distance ??
          (c.latitude && c.longitude
            ? distanceMi(origin.latitude, origin.longitude, c.latitude, c.longitude)
            : undefined),
      }))
      .filter((c) => c.distance !== undefined && c.distance <= radius);

    if (lower.length >= 1) {
      const matchesPrefix = (name: string) => {
        const low = name.toLowerCase();
        if (low.startsWith(lower)) return true;
        return low.split(/[\s\-']+/).some((w) => w.startsWith(lower));
      };

      let matched = results.filter((c) => matchesPrefix(c.name));

      if (matched.length === 0 && lower.length >= 3) {
        const named = await searchCoursesByName(lower);
        matched = named
          .map((c) => ({
            ...c,
            distance:
              c.distance ??
              (c.latitude && c.longitude
                ? distanceMi(origin.latitude, origin.longitude, c.latitude, c.longitude)
                : undefined),
          }))
          .filter(
            (c) =>
              matchesPrefix(c.name) &&
              c.distance !== undefined &&
              c.distance <= radius,
          );
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

  // Group open matches by course name
  const openMatchesByCourse = useMemo(() => {
    const map = new Map<string, typeof matches>();
    const now = new Date();
    matches
      .filter(
        (m) =>
          m.status === "open" &&
          new Date(m.scheduled_time) >= now &&
          (m.participant_count || 0) < m.max_participants,
      )
      .forEach((m) => {
        const key = m.course_name.toLowerCase().trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(m);
      });
    return map;
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

  const handleViewMatch = (matchId: string) => {
    navigate(`/match/${matchId}`);
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
                  aria-label={`Adjust search radius, currently ${radius} miles`}
                >
                  {radius}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64" align="start">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Search radius</span>
                    <span className="text-sm text-muted-foreground">{radius} mi</span>
                  </div>
                  <Slider
                    value={[radius]}
                    onValueChange={(v) => setRadius(v[0])}
                    min={1}
                    max={100}
                    step={1}
                    aria-label="Search radius in miles"
                  />
                </div>
              </PopoverContent>
            </Popover>
            miles
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
          const openMatches =
            openMatchesByCourse.get(course.name.toLowerCase().trim()) || [];
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
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewMatch(openMatches[0].id);
                    }}
                    className="shrink-0 bg-gradient-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(var(--primary)/0.7)] transition-shadow"
                  >
                    Join Match
                  </Button>
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
            ? (openMatchesByCourse.get(selectedCourse.name.toLowerCase().trim()) || []).map((m) => ({
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
          handleViewMatch(id);
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
