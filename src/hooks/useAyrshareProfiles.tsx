import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useAyrshareProfiles = () => {
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnectedProfiles();
  }, []);

  const fetchConnectedProfiles = async () => {
    try {
      setLoading(true);
      
      // Check if user is authenticated before making the call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Silently skip for unauthenticated users - no error logging
        setConnectedPlatforms([]);
        return;
      }
      
      const { data, error: functionError } = await supabase.functions.invoke("ayrshare-post", {
        body: { action: "get_profiles" },
      });

      if (functionError) {
        // Only log if it's not an auth error (expected for non-admin users)
        if (!functionError.message?.includes('401') && !functionError.message?.includes('Unauthorized')) {
          console.error("Error fetching Ayrshare profiles:", functionError);
        }
        setError("Failed to fetch connected platforms");
        return;
      }

      if (data?.data?.activeSocialAccounts) {
        // Convert to lowercase for consistent comparison
        const platforms = data.data.activeSocialAccounts.map((p: string) => p.toLowerCase());
        setConnectedPlatforms(platforms);
      }
    } catch (err: any) {
      // Silently handle errors - this is a non-critical feature
      setError("Failed to fetch connected platforms");
    } finally {
      setLoading(false);
    }
  };

  return { connectedPlatforms, loading, error, refetch: fetchConnectedProfiles };
};
