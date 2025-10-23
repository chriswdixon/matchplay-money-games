import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Wand2, RefreshCw } from "lucide-react";
import { useAIGolfCourses } from "@/hooks/useAIGolfCourses";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export const AIGolfCourseTools = () => {
  const { loading, enrichCourse, cleanupCourseData } = useAIGolfCourses();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);

  const handleBulkEnrich = async () => {
    try {
      setProcessing(true);
      
      // Get unenriched courses
      const { data: courses, error } = await supabase
        .from('golf_courses')
        .select('id')
        .eq('ai_enriched', false)
        .limit(10);

      if (error) throw error;

      if (!courses || courses.length === 0) {
        toast({
          title: "All Courses Enriched",
          description: "All courses have already been enriched with AI data.",
        });
        return;
      }

      toast({
        title: "Starting Bulk Enrichment",
        description: `Processing ${courses.length} courses...`,
      });

      let successCount = 0;
      for (const course of courses) {
        const result = await enrichCourse(course.id);
        if (result) successCount++;
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: "Bulk Enrichment Complete",
        description: `Successfully enriched ${successCount} of ${courses.length} courses.`,
      });

    } catch (error: any) {
      console.error('Bulk enrichment error:', error);
      toast({
        title: "Enrichment Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkCleanup = async () => {
    try {
      setProcessing(true);
      
      // Get courses that need cleanup
      const { data: courses, error } = await supabase
        .from('golf_courses')
        .select('id')
        .limit(10);

      if (error) throw error;

      if (!courses || courses.length === 0) {
        toast({
          title: "No Courses Found",
          description: "No courses available for cleanup.",
        });
        return;
      }

      toast({
        title: "Starting Bulk Cleanup",
        description: `Processing ${courses.length} courses...`,
      });

      let successCount = 0;
      for (const course of courses) {
        const result = await cleanupCourseData(course.id);
        if (result) successCount++;
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      toast({
        title: "Bulk Cleanup Complete",
        description: `Successfully cleaned ${successCount} of ${courses.length} courses.`,
      });

    } catch (error: any) {
      console.error('Bulk cleanup error:', error);
      toast({
        title: "Cleanup Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          AI Golf Course Tools
        </CardTitle>
        <CardDescription>
          Use AI to enrich, clean, and enhance golf course data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h4 className="font-medium">Bulk Enrich Courses</h4>
          <p className="text-sm text-muted-foreground">
            Add AI-generated descriptions, ratings, difficulty levels, and categories to courses.
          </p>
          <Button 
            onClick={handleBulkEnrich}
            disabled={loading || processing}
            className="w-full"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            {processing ? "Processing..." : "Enrich Unenriched Courses"}
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="font-medium">Bulk Cleanup Course Data</h4>
          <p className="text-sm text-muted-foreground">
            Standardize addresses, phone numbers, and other data fields.
          </p>
          <Button 
            onClick={handleBulkCleanup}
            disabled={loading || processing}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {processing ? "Processing..." : "Clean Up Course Data"}
          </Button>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> AI operations consume credits. Each operation processes up to 10 courses to avoid rate limits.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
