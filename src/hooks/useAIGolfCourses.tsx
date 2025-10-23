import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SmartSearchResult {
  courses: any[];
  searchCriteria: any;
}

interface Recommendation {
  recommendations: any[];
  reasoning: string;
}

export const useAIGolfCourses = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const enrichCourse = async (courseId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('enrich-golf-course', {
        body: { courseId }
      });

      if (error) throw error;

      toast({
        title: "Course Enriched",
        description: "AI has added details, ratings, and categories to this course.",
      });

      return data;
    } catch (error: any) {
      console.error('Error enriching course:', error);
      
      if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many AI requests. Please try again in a moment.",
          variant: "destructive",
        });
      } else if (error.message?.includes('402') || error.message?.includes('credits')) {
        toast({
          title: "AI Credits Depleted",
          description: "Please add credits to continue using AI features.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Enrichment Failed",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  const smartSearch = async (query: string, userLat?: number, userLon?: number): Promise<SmartSearchResult | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('smart-course-search', {
        body: { query, userLat, userLon }
      });

      if (error) throw error;

      return data;
    } catch (error: any) {
      console.error('Error in smart search:', error);
      
      if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many AI requests. Please try again in a moment.",
          variant: "destructive",
        });
      } else if (error.message?.includes('402') || error.message?.includes('credits')) {
        toast({
          title: "AI Credits Depleted",
          description: "Please add credits to continue using AI features.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Search Failed",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getRecommendations = async (userLat?: number, userLon?: number, limit: number = 5): Promise<Recommendation | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('recommend-courses', {
        body: { userLat, userLon, limit }
      });

      if (error) throw error;

      return data;
    } catch (error: any) {
      console.error('Error getting recommendations:', error);
      
      if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many AI requests. Please try again in a moment.",
          variant: "destructive",
        });
      } else if (error.message?.includes('402') || error.message?.includes('credits')) {
        toast({
          title: "AI Credits Depleted",
          description: "Please add credits to continue using AI features.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Recommendations Failed",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  const cleanupCourseData = async (courseId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('cleanup-course-data', {
        body: { courseId }
      });

      if (error) throw error;

      toast({
        title: "Data Cleaned",
        description: `AI standardized the course data. Changes: ${data.changes.join(', ')}`,
      });

      return data;
    } catch (error: any) {
      console.error('Error cleaning course data:', error);
      
      if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
        toast({
          title: "Rate Limit Exceeded",
          description: "Too many AI requests. Please try again in a moment.",
          variant: "destructive",
        });
      } else if (error.message?.includes('402') || error.message?.includes('credits')) {
        toast({
          title: "AI Credits Depleted",
          description: "Please add credits to continue using AI features.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Cleanup Failed",
          description: error.message,
          variant: "destructive",
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    enrichCourse,
    smartSearch,
    getRecommendations,
    cleanupCourseData,
  };
};
