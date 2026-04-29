import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WinPost {
  id: string;
  match_id: string;
  winner_user_id: string;
  course_name: string;
  format: string;
  holes: number;
  is_team_win: boolean;
  team_number: number | null;
  created_at: string;
  display_name: string | null;
  profile_picture_url: string | null;
}

export function useWinsFeed(limit = 50) {
  const [posts, setPosts] = useState<WinPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: winRows, error: winErr } = await supabase
      .from("match_win_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (winErr) {
      setError(winErr.message);
      setLoading(false);
      return;
    }

    const userIds = Array.from(new Set((winRows ?? []).map((r) => r.winner_user_id)));

    let profileMap = new Map<string, { display_name: string | null; profile_picture_url: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, profile_picture_url")
        .in("user_id", userIds);

      profileMap = new Map(
        (profiles ?? []).map((p) => [
          p.user_id,
          { display_name: p.display_name, profile_picture_url: p.profile_picture_url },
        ]),
      );
    }

    const merged: WinPost[] = (winRows ?? []).map((r) => ({
      ...r,
      display_name: profileMap.get(r.winner_user_id)?.display_name ?? null,
      profile_picture_url: profileMap.get(r.winner_user_id)?.profile_picture_url ?? null,
    }));

    setPosts(merged);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return { posts, loading, error, refetch: fetchFeed };
}
