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

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (mode === "matches") {
      onMatchSearchChange(query);
      return;
    }
    setSearched(true);
    if (query.trim().length >= 2) {
      const results = await searchCoursesByName(query.trim());
      setCourseResults(results.slice(0, 12));
    } else {
      // No query — find nearby
      if (!location) {
        await requestLocation();
        return;
      }
      const results = await searchNearbyCourses(location.latitude, location.longitude, 30);
      setCourseResults(results.slice(0, 12));
    }
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
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
            className="pl-10 h-11"
            aria-label={mode === "matches" ? "Search matches" : "Search courses"}
          />
        </div>
        <Button type="submit" className="h-11" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
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
                  <Plus className="w-4 h-4 mr-1" />
                  Match
                </Button>
              </CardContent>
            </Card>
          ))}
          {!location && courseResults.length === 0 && !loading && (
            <Button variant="outline" className="w-full" onClick={() => requestLocation()}>
              <Navigation className="w-4 h-4 mr-2" />
              Enable location for nearby courses
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CourseOrMatchSearch;
