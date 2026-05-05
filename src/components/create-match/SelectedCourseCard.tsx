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
      className="w-full max-w-full overflow-hidden rounded-2xl bg-success text-white shadow-card border-2 border-success p-3 sm:p-4 flex items-start gap-2 sm:gap-3"
    >
      <div className="shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/15 flex items-center justify-center">
        <MapPin className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="text-[10px] sm:text-[11px] uppercase tracking-wide font-semibold text-white/80 truncate">
            Selected Course
          </div>
          <div
            className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold bg-white/15 px-1.5 py-0.5 rounded-full"
            title="Course is locked. Go back to choose a different one."
          >
            <Lock className="w-3 h-3" aria-hidden="true" />
            Locked
          </div>
        </div>
        <div className="font-bold text-sm sm:text-base truncate">{course.name}</div>
        {course.address && (
          <div className="text-xs text-white/85 truncate mt-0.5">
            {course.address}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectedCourseCard;
