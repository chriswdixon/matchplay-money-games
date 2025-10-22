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
      const { data, error: functionError } = await supabase.functions.invoke("ayrshare-post", {
        body: { action: "get_profiles" },
      });

      if (functionError) {
        console.error("Error fetching Ayrshare profiles:", functionError);
        setError("Failed to fetch connected platforms");
        return;
      }

      if (data?.data?.activeSocialAccounts) {
        // Convert to lowercase for consistent comparison
        const platforms = data.data.activeSocialAccounts.map((p: string) => p.toLowerCase());
        setConnectedPlatforms(platforms);
      }
    } catch (err: any) {
      console.error("Error fetching Ayrshare profiles:", err);
      setError("Failed to fetch connected platforms");
    } finally {
      setLoading(false);
    }
  };

  return { connectedPlatforms, loading, error, refetch: fetchConnectedProfiles };
};
