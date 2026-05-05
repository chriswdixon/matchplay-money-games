import { MapPin, Lock } from "lucide-react";

interface SelectedCourseCardProps {
  course: {
    name: string;
    address?: string;
  };
}

/**
 * Locked, read-only display of the golf course selected from the prior screen.
 * Shown at the top of the Create Match flow so the user can confirm the course
 * but cannot change it inline (they must restart the flow from the course list).
 */
const SelectedCourseCard = ({ course }: SelectedCourseCardProps) => {
  return (
    <div
      role="region"
      aria-label="Selected golf course"
      className="rounded-2xl bg-success text-white shadow-card border-2 border-success p-4 flex items-start gap-3"
    >
      <div className="shrink-0 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
        <MapPin className="w-5 h-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide font-semibold text-white/80 mb-0.5">
          Selected Course
        </div>
        <div className="font-bold text-base truncate">{course.name}</div>
        {course.address && (
          <div className="text-xs text-white/85 truncate mt-0.5">
            {course.address}
          </div>
        )}
      </div>
      <div
        className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold bg-white/15 px-2 py-1 rounded-full"
        title="Course is locked. Go back to choose a different one."
      >
        <Lock className="w-3 h-3" aria-hidden="true" />
        Locked
      </div>
    </div>
  );
};

export default SelectedCourseCard;
