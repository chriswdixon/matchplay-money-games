import { Home, Search, Trophy, UserCircle2, Target, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";

export type BottomTab =
  | "home"
  | "matches"
  | "active-match"
  | "past"
  | "wallet"
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
  const { unreadCount } = useNotifications();

  const items: { id: BottomTab; label: string; Icon: typeof Home }[] = [
    { id: "home", label: "Home", Icon: Home },
    ...(hasActiveMatch
      ? [{ id: "active-match" as BottomTab, label: "Active Match", Icon: Target }]
      : []),
    { id: "past", label: "History", Icon: Trophy },
    { id: "wallet", label: "Wallet", Icon: Landmark },
    { id: "profile", label: "Profile", Icon: UserCircle2 },
  ];

  const handleClick = (id: BottomTab) => {
    if (id === "profile") {
      navigate("/profile");
      return;
    }
    if (id === "wallet") {
      navigate("/wallet");
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
            const badge = id === "profile" ? unreadCount : 0;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleClick(id)}
                aria-label={badge > 0 ? `${label} (${badge} unread notifications)` : label}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center justify-center flex-1 min-w-0 h-12"
              >
                <span
                  className={cn(
                    "relative flex items-center justify-center rounded-full transition-all w-10 h-10",
                    active
                      ? "bg-primary text-primary-foreground shadow-accent"
                      : "text-background/90 hover:text-background",
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  {badge > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-foreground"
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
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
