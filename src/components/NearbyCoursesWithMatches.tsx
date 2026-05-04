import { useEffect, useMemo, useState } from "react";
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

const RADIUS_MI = 30;

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
  const { location, requestLocation } = useLocation();
  const { matches } = useMatches();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Auto-load nearby courses once we have GPS
  useEffect(() => {
    if (location && !searched && !query) {
      runSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const runSearch = async (q: string) => {
    if (!location) {
      await requestLocation();
      return;
    }
    setSearched(true);
    let results: GolfCourse[];
    if (q.trim().length >= 2) {
      const named = await searchCoursesByName(q.trim());
      results = named
        .map((c) => ({
          ...c,
          distance:
            c.distance ??
            (c.latitude && c.longitude
              ? distanceMi(location.latitude, location.longitude, c.latitude, c.longitude)
              : undefined),
        }))
        .filter((c) => c.distance !== undefined && c.distance <= RADIUS_MI)
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else {
      results = await searchNearbyCourses(location.latitude, location.longitude, RADIUS_MI);
    }
    setCourses(results.slice(0, 20));
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
    navigate("/create-match", {
      state: {
        prefilledCourse: {
          name: course.name,
          address: course.address,
          latitude: course.latitude,
          longitude: course.longitude,
          website: course.website,
        },
      },
    });
  };

  const handleViewMatch = (matchId: string) => {
    navigate(`/match/${matchId}`);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses near you (or leave blank)"
            className="pl-10 h-11"
            aria-label="Search courses and matches near you"
          />
        </div>
        <Button type="submit" className="h-11" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {!location && (
        <Button variant="outline" className="w-full" onClick={() => requestLocation()}>
          <Navigation className="w-4 h-4 mr-2" />
          Enable location to see nearby courses
        </Button>
      )}

      {location && (
        <p className="text-xs text-muted-foreground px-1" aria-live="polite">
          <MapPin className="w-3 h-3 inline mr-1" aria-hidden="true" />
          Showing courses within {RADIUS_MI} miles
        </p>
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
        {courses.map((course, i) => {
          const openMatches =
            openMatchesByCourse.get(course.name.toLowerCase().trim()) || [];
          const hasOpenMatch = openMatches.length > 0;
          return (
            <Card key={`${course.name}-${i}`} className="bg-card">
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
                    onClick={() => handleViewMatch(openMatches[0].id)}
                    className="shrink-0 bg-gradient-primary text-primary-foreground"
                  >
                    Open Match
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateAtCourse(course)}
                    className="shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default NearbyCoursesWithMatches;
