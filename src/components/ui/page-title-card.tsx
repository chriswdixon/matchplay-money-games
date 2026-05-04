import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTitleCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Standard page title surface — keeps every page's H1 in a consistent
 * rounded card so headers feel anchored across the app.
 */
export function PageTitleCard({
  title,
  description,
  icon,
  actions,
  className,
}: PageTitleCardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-3xl shadow-card border border-border/60 p-4 md:p-6 flex items-start gap-4",
        className,
      )}
    >
      {icon && (
        <div className="shrink-0 w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export default PageTitleCard;
