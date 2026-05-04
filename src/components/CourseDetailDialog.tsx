import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Globe, Users, Trophy, Flag } from "lucide-react";
import { useGolfCourses, type GolfCourse } from "@/hooks/useGolfCourses";

interface OpenMatchSummary {
  id: string;
  participant_count?: number;
  max_participants: number;
  buy_in_amount: number;
  scheduled_time: string;
  format: string;
}

interface CourseDetailDialogProps {
  course: GolfCourse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openMatches: OpenMatchSummary[];
  onJoinMatch: (matchId: string) => void;
  onCreateMatch: (course: GolfCourse) => void;
}

const CourseDetailDialog = ({
  course,
  open,
  onOpenChange,
  openMatches,
  onJoinMatch,
  onCreateMatch,
}: CourseDetailDialogProps) => {
  const { fetchCourseDetail } = useGolfCourses();
  const [detail, setDetail] = useState<GolfCourse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !course) {
      setDetail(null);
      return;
    }
    // Seed with what we already know
    setDetail(course);
    if (course.externalId) {
      setLoading(true);
      fetchCourseDetail(course.externalId)
        .then((d) => {
          if (d) setDetail({ ...course, ...d });
        })
        .finally(() => setLoading(false));
    }
  }, [open, course?.externalId]);

  if (!course) return null;

  const tees = detail?.tees || [];
  const maleTees = Array.isArray(tees)
    ? (tees as any).male || tees.filter?.((t: any) => t.gender === "male") || []
    : [];
  const femaleTees = Array.isArray(tees)
    ? (tees as any).female || tees.filter?.((t: any) => t.gender === "female") || []
    : [];
  const allTees = [
    ...(Array.isArray(maleTees) ? maleTees : []),
    ...(Array.isArray(femaleTees) ? femaleTees : []),
  ];

  const hasOpenMatch = openMatches.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{detail?.name || course.name}</DialogTitle>
          {detail?.clubName && detail.clubName !== detail.name && (
            <DialogDescription>{detail.clubName}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2 text-sm">
            <p className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
              <span>{detail?.address || course.address}</span>
            </p>
            {course.distance !== undefined && (
              <p className="text-primary text-xs">
                {course.distance.toFixed(1)} miles away
              </p>
            )}
            {detail?.website && (
              <a
                href={detail.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <Globe className="w-4 h-4" aria-hidden="true" />
                Visit website
              </a>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading course details...
            </div>
          )}

          {allTees.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Flag className="w-4 h-4" aria-hidden="true" />
                Tee Boxes
              </h3>
              <div className="grid gap-2">
                {allTees.slice(0, 6).map((tee: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs bg-muted rounded-md p-2"
                  >
                    <div>
                      <p className="font-medium">{tee.tee_name}</p>
                      <p className="text-muted-foreground capitalize">{tee.gender}</p>
                    </div>
                    <div className="text-right text-muted-foreground">
                      <p>{tee.total_yards} yds • Par {tee.par_total}</p>
                      <p>
                        {tee.course_rating}/{tee.slope_rating}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasOpenMatch && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="w-4 h-4" aria-hidden="true" />
                Open Matches ({openMatches.length})
              </h3>
              <div className="space-y-2">
                {openMatches.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 bg-muted rounded-md p-2"
                  >
                    <div className="text-xs min-w-0 flex-1">
                      <p className="font-medium capitalize">{m.format.replace(/_/g, " ")}</p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" aria-hidden="true" />
                        {m.participant_count || 0}/{m.max_participants} •
                        ${(m.buy_in_amount / 100).toFixed(0)} entry
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onJoinMatch(m.id)}
                      className="shrink-0 bg-gradient-primary text-primary-foreground"
                    >
                      Join
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {hasOpenMatch ? (
              <Button
                className="flex-1 bg-gradient-primary text-primary-foreground hover:shadow-[0_0_20px_hsl(var(--primary)/0.7)] transition-shadow"
                onClick={() => onJoinMatch(openMatches[0].id)}
              >
                Join Match
              </Button>
            ) : (
              <Button
                className="flex-1 bg-success text-success-foreground hover:bg-success hover:shadow-[0_0_20px_hsl(var(--success)/0.7)] transition-shadow"
                onClick={() => onCreateMatch(detail || course)}
              >
                Create Match Here
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CourseDetailDialog;
