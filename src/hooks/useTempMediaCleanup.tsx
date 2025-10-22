import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to periodically clean up old temporary media files
 * Runs cleanup function every hour to remove files older than 24 hours
 */
export const useTempMediaCleanup = () => {
  useEffect(() => {
    const cleanupTempMedia = async () => {
      try {
        const { data, error } = await supabase.rpc('cleanup_old_temp_media');
        
        if (error) {
          console.error('Error cleaning up temp media:', error);
          return;
        }
        
        if (data && data > 0) {
          console.log(`Cleaned up ${data} old temporary media files`);
        }
      } catch (error) {
        console.error('Error in temp media cleanup:', error);
      }
    };

    // Run cleanup immediately on mount
    cleanupTempMedia();

    // Run cleanup every hour
    const intervalId = setInterval(cleanupTempMedia, 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);
};
