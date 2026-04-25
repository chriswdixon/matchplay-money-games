import { Home, Trophy, Landmark, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export type BottomTab = "home" | "past" | "subscription" | "profile";

interface BottomTabBarProps {
  activeTab: BottomTab;
  onChange: (tab: BottomTab) => void;
}

const items: { id: BottomTab; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "past", label: "Past Matches", Icon: Trophy },
  { id: "subscription", label: "Membership", Icon: Landmark },
  { id: "profile", label: "Profile", Icon: UserCircle2 },
];

const BottomTabBar = ({ activeTab, onChange }: BottomTabBarProps) => {
  const navigate = useNavigate();

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
      className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 pointer-events-none"
    >
      <div className="mx-auto max-w-md pointer-events-auto">
        <div className="flex items-center justify-between gap-2 bg-foreground text-background rounded-full px-4 py-3 shadow-premium">
          {items.map(({ id, label, Icon }) => {
            const active = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleClick(id)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center transition-all",
                  active
                    ? "bg-primary text-primary-foreground rounded-full w-12 h-12 shadow-accent"
                    : "text-background/90 hover:text-background w-12 h-12 rounded-full",
                )}
              >
                <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomTabBar;
