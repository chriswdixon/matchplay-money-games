import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@/assets/hero-golf-course.jpg?format=webp&quality=80";

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
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Recently Played</h3>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (courses.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3">Recently Played</h3>
      <div className="grid grid-cols-3 gap-3">
        {courses.map((c) => (
          <button
            key={c.match_id}
            type="button"
            onClick={() => onSelect?.(c.course_name)}
            className="group relative aspect-square rounded-2xl overflow-hidden ring-2 ring-primary/70 hover:ring-primary transition-all text-left"
          >
            <img
              src={heroImage}
              alt={c.course_name}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
              <div className="text-xs font-semibold truncate">{c.course_name}</div>
              <div className="flex items-center gap-1 text-[10px] opacity-90">
                <Star className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                <span>Played</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecentlyPlayedCourses;
