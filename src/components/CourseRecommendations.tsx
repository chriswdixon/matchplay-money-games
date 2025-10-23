import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, Star } from "lucide-react";
import { useAIGolfCourses } from "@/hooks/useAIGolfCourses";
import { useLocation } from "@/hooks/useLocation";
import { Badge } from "@/components/ui/badge";

export const CourseRecommendations = () => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [reasoning, setReasoning] = useState("");
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
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Recommended For You
        </CardTitle>
        <CardDescription>
          AI-powered course recommendations based on your play history and preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.length === 0 ? (
          <Button 
            onClick={loadRecommendations} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Loading..." : "Get Personalized Recommendations"}
          </Button>
        ) : (
          <>
            {reasoning && (
              <p className="text-sm text-muted-foreground italic border-l-2 border-primary pl-3">
                {reasoning}
              </p>
            )}
            
            <div className="space-y-3">
              {recommendations.map((course) => (
                <Card key={course.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{course.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {course.city}, {course.state}
                        </p>
                      </div>
                      {course.ai_rating && (
                        <Badge variant="secondary">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          {course.ai_rating.toFixed(1)}
                        </Badge>
                      )}
                    </div>

                    {course.description && (
                      <p className="text-sm">{course.description}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
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
                          <MapPin className="h-3 w-3 mr-1" />
                          {course.distance.toFixed(1)} mi
                        </Badge>
                      )}
                    </div>

                    {course.features && course.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {course.features.slice(0, 4).map((feature: string) => (
                          <span key={feature} className="text-xs bg-muted px-2 py-1 rounded">
                            {feature}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <Button 
              onClick={loadRecommendations} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? "Refreshing..." : "Refresh Recommendations"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
