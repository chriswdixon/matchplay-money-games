import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, Sparkles, MapPin } from "lucide-react";
import { useAIGolfCourses } from "@/hooks/useAIGolfCourses";
import { useLocation } from "@/hooks/useLocation";
import { Badge } from "@/components/ui/badge";

interface SmartCourseSearchProps {
  onResults?: (courses: any[]) => void;
}

export const SmartCourseSearch = ({ onResults }: SmartCourseSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searchCriteria, setSearchCriteria] = useState<any>(null);
  const { loading, smartSearch } = useAIGolfCourses();
  const { location } = useLocation();

  const handleSearch = async () => {
    if (!query.trim()) return;

    const result = await smartSearch(
      query,
      location?.latitude,
      location?.longitude
    );

    if (result) {
      setResults(result.courses);
      setSearchCriteria(result.searchCriteria);
      onResults?.(result.courses);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10">
        <div className="flex gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI-Powered Smart Search</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Search naturally: "challenging courses near me", "beginner friendly with driving range", "top rated desert courses"
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              placeholder="Describe what you're looking for..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pr-10"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </Card>

      {searchCriteria && (
        <Card className="p-4 bg-muted/50">
          <p className="text-sm font-medium mb-2">Search understood as:</p>
          <div className="flex flex-wrap gap-2">
            {searchCriteria.difficulty_level && (
              <Badge variant="secondary">
                Difficulty: {searchCriteria.difficulty_level}
              </Badge>
            )}
            {searchCriteria.course_style && (
              <Badge variant="secondary">
                Style: {searchCriteria.course_style}
              </Badge>
            )}
            {searchCriteria.max_distance_miles && (
              <Badge variant="secondary">
                <MapPin className="h-3 w-3 mr-1" />
                Within {searchCriteria.max_distance_miles} miles
              </Badge>
            )}
            {searchCriteria.features?.map((feature: string) => (
              <Badge key={feature} variant="outline">
                {feature}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {results.length > 0 && (
        <div className="text-sm text-muted-foreground">
          Found {results.length} course{results.length === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
};
