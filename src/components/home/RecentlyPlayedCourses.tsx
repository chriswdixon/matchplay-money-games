import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, History, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

interface RecentCourse {
  course_name: string;
  match_id: string;
  played_at: string;
  rating?: number;
}

const RecentlyPlayedCourses = ({ onSelect }: { onSelect?: (courseName: string) => void }) => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<RecentCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const { data: participations } = await supabase
          .from("match_participants")
          .select("match_id")
          .eq("user_id", user.id)
          .limit(50);

        const matchIds = (participations || []).map((p) => p.match_id);
        if (matchIds.length === 0) {
          setCourses([]);
          return;
        }

        const { data: matches } = await supabase
          .from("matches")
          .select("id, course_name, scheduled_time, holes")
          .in("id", matchIds)
          .eq("status", "completed")
          .order("scheduled_time", { ascending: false })
          .limit(12);

        const seen = new Set<string>();
        const recent: RecentCourse[] = [];
        for (const m of matches || []) {
          const key = m.course_name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          recent.push({
            course_name: m.course_name,
            match_id: m.id,
            played_at: m.scheduled_time,
          });
          if (recent.length >= 3) break;
        }

        setCourses(recent);
      } catch (e) {
        console.error("Failed to load recent courses", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <section
      aria-labelledby="recently-played-heading"
      className="rounded-3xl bg-foreground text-background p-4 md:p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-background/15">
        <h2 id="recently-played-heading" className="text-lg font-bold flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-success text-white shrink-0">
            <History className="w-5 h-5" aria-hidden="true" />
          </span>
          Recent Matches
        </h2>
      </div>

      <div className="space-y-2">
        {loading ? (
          [1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl bg-background/10" />
          ))
        ) : courses.length === 0 ? (
          <div className="py-6 text-center text-sm text-background/70">
            <History className="w-8 h-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
            No recently played courses yet.
          </div>
        ) : (
          courses.map((c) => (
            <button
              key={c.match_id}
              type="button"
              onClick={() => onSelect?.(c.course_name)}
              className="w-full flex items-center gap-3 bg-background/95 text-foreground rounded-2xl px-3 py-3 text-left hover:bg-background transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate text-sm">{c.course_name}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">Played</span>
                  {c.rating != null && (
                    <>
                      <span aria-hidden="true" className="opacity-60">•</span>
                      <Star className="w-3 h-3 fill-current" aria-hidden="true" />
                      <span>{c.rating.toFixed(1)}</span>
                    </>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(c.played_at), { addSuffix: true })}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
};

export default RecentlyPlayedCourses;
