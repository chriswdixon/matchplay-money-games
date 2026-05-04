import { Home, Search, History, Trophy, Crown, UserCircle2, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export type BottomTab =
  | "home"
  | "matches"
  | "active-match"
  | "past"
  | "handicap"
  | "subscription"
  | "profile";

interface BottomTabBarProps {
  activeTab: BottomTab;
  onChange: (tab: BottomTab) => void;
  hasActiveMatch?: boolean;
}

const BottomTabBar = ({ activeTab, onChange, hasActiveMatch }: BottomTabBarProps) => {
  const navigate = useNavigate();

  const items: { id: BottomTab; label: string; Icon: typeof Home }[] = [
    { id: "home", label: "Home", Icon: Home },
    { id: "matches", label: "Find Matches", Icon: Search },
    ...(hasActiveMatch
      ? [{ id: "active-match" as BottomTab, label: "Active Match", Icon: Target }]
      : []),
    { id: "past", label: "Past Matches", Icon: History },
    { id: "handicap", label: "Handicap", Icon: Trophy },
    { id: "subscription", label: "Membership", Icon: Crown },
    { id: "profile", label: "Profile", Icon: UserCircle2 },
  ];

  const handleClick = (id: BottomTab) => {
    if (id === "profile") {
      navigate("/profile");
      return;
    }
    onChange(id);
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed left-0 right-0 z-40 px-2 pointer-events-none bottom-0 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 md:bottom-auto md:top-0 md:pt-[max(env(safe-area-inset-top),0.75rem)] md:pb-3"
    >
      <div className="mx-auto max-w-2xl pointer-events-auto">
        <div className="flex items-center justify-between gap-1 bg-foreground text-background rounded-full px-2 py-2 shadow-premium">
          {items.map(({ id, label, Icon }) => {
            const active = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleClick(id)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center justify-center flex-1 min-w-0 h-12"
              >
                <span
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all w-10 h-10",
                    active
                      ? "bg-primary text-primary-foreground shadow-accent"
                      : "text-background/90 hover:text-background",
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                </span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 h-1 w-5 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomTabBar;
