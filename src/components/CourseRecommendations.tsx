import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, Star, ChevronDown, ChevronUp } from "lucide-react";
import { useAIGolfCourses } from "@/hooks/useAIGolfCourses";
import { useLocation } from "@/hooks/useLocation";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export const CourseRecommendations = () => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { loading, getRecommendations } = useAIGolfCourses();
  const { location } = useLocation();

  const loadRecommendations = async () => {
    const result = await getRecommendations(
      location?.latitude,
      location?.longitude,
      5
    );

    if (result) {
      setRecommendations(result.recommendations);
      setReasoning(result.reasoning);
      setIsOpen(true);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <Card className="border-primary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">AI Course Recommendations</CardTitle>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            <CardDescription className="text-xs">
              Personalized suggestions based on your play history
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {recommendations.length === 0 ? (
              <Button 
                onClick={loadRecommendations} 
                disabled={loading}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <Sparkles className="h-3 w-3 mr-2" />
                {loading ? "Loading..." : "Get Recommendations"}
              </Button>
            ) : (
              <>
                {reasoning && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary pl-2">
                    {reasoning}
                  </p>
                )}
                
                <div className="space-y-2">
                  {recommendations.map((course) => (
                    <div key={course.id} className="p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="text-sm font-semibold">{course.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {course.city}, {course.state}
                            </p>
                          </div>
                          {course.ai_rating && (
                            <Badge variant="secondary" className="text-xs">
                              <Star className="h-2 w-2 mr-1 fill-current" />
                              {course.ai_rating.toFixed(1)}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {course.difficulty_level && (
                            <Badge variant="outline" className="text-xs">
                              {course.difficulty_level}
                            </Badge>
                          )}
                          {course.course_style && (
                            <Badge variant="outline" className="text-xs">
                              {course.course_style}
                            </Badge>
                          )}
                          {course.distance && (
                            <Badge variant="outline" className="text-xs">
                              <MapPin className="h-2 w-2 mr-1" />
                              {course.distance.toFixed(1)} mi
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  onClick={loadRecommendations} 
                  disabled={loading}
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs"
                >
                  {loading ? "Refreshing..." : "Refresh Recommendations"}
                </Button>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
