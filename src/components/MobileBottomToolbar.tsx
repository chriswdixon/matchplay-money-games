import { Link, useLocation } from "react-router-dom";
import { Home, Plus, Search, Trophy, UserCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Home", Icon: Home, match: (p: string, s: string) => p === "/" && !s.includes("tab=matches") },
  { to: "/create-match", label: "Create", Icon: Plus, match: (p: string) => p === "/create-match" },
  { to: "/?tab=matches", label: "Find", Icon: Search, match: (p: string, s: string) => p === "/" && s.includes("tab=matches") },
  { to: "/my-matches", label: "History", Icon: Trophy, match: (p: string) => p === "/my-matches" },
  { to: "/profile", label: "Profile", Icon: UserCircle2, match: (p: string) => p.startsWith("/profile") },
];

const MobileBottomToolbar = () => {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return null;

  return (
    <nav
      role="toolbar"
      aria-label="Quick actions"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
    >
      <ul className="grid grid-cols-5 gap-1 px-2">
        {items.map(({ to, label, Icon, match }) => {
          const active = match(location.pathname, location.search);
          return (
            <li key={to} className="flex">
              <Link
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary bg-primary/10"
                    : "text-foreground/70 hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MobileBottomToolbar;
