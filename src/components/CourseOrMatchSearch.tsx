import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Loader2, Plus, Navigation } from "lucide-react";
import { useGolfCourses, type GolfCourse } from "@/hooks/useGolfCourses";
import { useLocation } from "@/hooks/useLocation";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type SearchMode = "matches" | "courses";

interface CourseOrMatchSearchProps {
  matchSearch: string;
  onMatchSearchChange: (value: string) => void;
}

const CourseOrMatchSearch = ({ matchSearch, onMatchSearchChange }: CourseOrMatchSearchProps) => {
  const [mode, setMode] = useState<SearchMode>("matches");
  const [query, setQuery] = useState(matchSearch);
  const [courseResults, setCourseResults] = useState<GolfCourse[]>([]);
  const [searched, setSearched] = useState(false);
  const { searchCoursesByName, searchNearbyCourses, loading } = useGolfCourses();
  const { location, requestLocation } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (mode === "matches") {
      onMatchSearchChange(query);
      return;
    }
    setSearched(true);

    // Course search requires GPS — only nearby (within 30mi)
    if (!location) {
      await requestLocation();
      return;
    }

    let results: GolfCourse[];
    if (query.trim().length >= 2) {
      const named = await searchCoursesByName(query.trim());
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
    setCourseResults(results.slice(0, 12));
  };

  const handleModeChange = (value: string) => {
    if (!value) return;
    setMode(value as SearchMode);
    setSearched(false);
    setCourseResults([]);
  };

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
      externalId: (course as any).externalId,
      booking_url: course.website,
    };
    try {
      sessionStorage.setItem("tyche-prefilled-course", JSON.stringify(prefilledCourse));
    } catch {}
    navigate("/create-match", { state: { prefilledCourse } });
  };

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={handleModeChange}
        className="justify-start"
        aria-label="Search type"
      >
        <ToggleGroupItem value="matches" aria-label="Search matches">
          Matches nearby
        </ToggleGroupItem>
        <ToggleGroupItem value="courses" aria-label="Search courses">
          Courses nearby
        </ToggleGroupItem>
      </ToggleGroup>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success-foreground/80" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (mode === "matches") onMatchSearchChange(e.target.value);
            }}
            placeholder={
              mode === "matches"
                ? "Search by course or location..."
                : "Course name, city, or leave blank for nearby"
            }
            className="pl-10 h-11 bg-success text-success-foreground placeholder:text-success-foreground/70 border-success focus-visible:ring-success"
            aria-label={mode === "matches" ? "Search matches" : "Search courses"}
          />
        </div>
        {loading && (
          <div className="flex items-center px-2" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </form>

      {mode === "courses" && searched && (
        <div className="space-y-2">
          {loading && courseResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Searching courses...</p>
          )}
          {!loading && courseResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No courses found. Try a different search.
            </p>
          )}
          {courseResults.map((course, i) => (
            <Card key={`${course.name}-${i}`} className="bg-card">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{course.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{course.address}</span>
                    {course.distance !== undefined && (
                      <span className="text-primary shrink-0">
                        • {course.distance.toFixed(1)}mi
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateAtCourse(course)}
                  className="shrink-0"
                >
                  Match
                </Button>
              </CardContent>
            </Card>
          ))}
          {!location && courseResults.length === 0 && !loading && (
            <Button variant="outline" className="w-full" onClick={() => requestLocation()}>
              Enable location for nearby courses
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseOrMatchSearch;
