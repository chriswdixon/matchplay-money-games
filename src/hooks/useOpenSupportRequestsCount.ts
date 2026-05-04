import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminRole } from "./useAdminRole";

/**
 * Returns the count of open support requests. Only fetches when the current
 * user is an admin (RLS would block non-admins anyway). Subscribes to realtime
 * changes so the badge stays fresh.
 */
export const useOpenSupportRequestsCount = () => {
  const { isAdmin } = useAdminRole();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      setCount(0);
      return;
    }

    let cancelled = false;

    const fetchCount = async () => {
      setLoading(true);
      const { count: c, error } = await supabase
        .from("support_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      if (!cancelled) {
        if (!error && typeof c === "number") setCount(c);
        setLoading(false);
      }
    };

    fetchCount();

    const channel = supabase
      .channel("admin-open-support-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_requests" },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  return { count, loading };
};
