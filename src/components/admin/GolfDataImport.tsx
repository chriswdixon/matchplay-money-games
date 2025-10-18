import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database, Loader2 } from "lucide-react";

export const GolfDataImport = () => {
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleImport = async () => {
    try {
      setImporting(true);
      
      const { data, error } = await supabase.functions.invoke('import-golf-courses');
      
      if (error) throw error;
      
      toast({
        title: "Import Successful",
        description: data.message || `Imported ${data.imported} golf courses`,
      });
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Golf Course Data Import
        </CardTitle>
        <CardDescription>
          Import or update golf course data from golfcourseapi.com into the database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleImport} 
          disabled={importing}
          size="lg"
        >
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            'Import Golf Data'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
