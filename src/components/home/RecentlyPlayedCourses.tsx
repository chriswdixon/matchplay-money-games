import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import CourseImage from "@/components/CourseImage";

interface RecentCourse {
  course_name: string;
  match_id: string;
  played_at: string;
  score?: string; // e.g. "4/7" derived from completed_holes / total_holes
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
        // Get last 12 completed matches the user joined, dedupe by course_name, take 3
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

  if (loading) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Recently Played</h3>
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 snap-x snap-mandatory">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="w-36 h-36 rounded-2xl shrink-0 snap-start" />
          ))}
        </div>
      </div>
    );
  }

  if (courses.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Recently Played</h3>
      <div
        className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1 snap-x snap-mandatory scroll-pl-4"
        role="list"
      >
        {courses.map((c, idx) => {
          const playedDate = new Date(c.played_at);
          const dateLabel = `${playedDate.getMonth() + 1}/${playedDate.getDate()}`;
          return (
            <button
              key={c.match_id}
              type="button"
              role="listitem"
              onClick={() => onSelect?.(c.course_name)}
              className={cn(
                "group relative w-36 h-36 shrink-0 snap-start rounded-2xl overflow-hidden ring-2 ring-primary/70 hover:ring-primary transition-all text-left",
                idx === courses.length - 1 && "mr-4",
              )}
            >
              <CourseImage
                src={null}
                alt={c.course_name}
                containerClassName="absolute inset-0 w-full h-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2.5 text-white">
                <div className="text-xs font-bold truncate leading-tight">{c.course_name}</div>
                <div className="flex items-center gap-1.5 text-[11px] mt-0.5 opacity-95">
                  <span className="font-semibold">{dateLabel}</span>
                  <span aria-hidden="true" className="opacity-70">|</span>
                  <Star className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                  <span className="font-semibold">{c.rating?.toFixed(1) ?? "—"}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RecentlyPlayedCourses;
