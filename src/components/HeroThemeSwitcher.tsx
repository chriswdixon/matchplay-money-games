import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

type HeroTheme = "gold" | "green" | "teal";

const THEMES: { id: HeroTheme; label: string; swatch: string }[] = [
  { id: "gold", label: "Gold", swatch: "bg-[hsl(42_85%_55%)]" },
  { id: "green", label: "Green", swatch: "bg-[hsl(145_70%_45%)]" },
  { id: "teal", label: "Teal", swatch: "bg-[hsl(178_75%_42%)]" },
];

const STORAGE_KEY = "tyche-hero-theme";

export const applyHeroTheme = (theme: HeroTheme) => {
  const root = document.documentElement;
  root.classList.remove("theme-gold", "theme-green", "theme-teal");
  root.classList.add(`theme-${theme}`);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
};

export const getStoredHeroTheme = (): HeroTheme => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "gold" || v === "green" || v === "teal") return v;
  } catch {
    /* ignore */
  }
  return "green";
};

const HeroThemeSwitcher = () => {
  const [theme, setTheme] = useState<HeroTheme>(() => getStoredHeroTheme());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    applyHeroTheme(theme);
  }, [theme]);

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div className="bg-card border rounded-2xl shadow-premium p-2 flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2">
          <p className="text-[10px] font-semibold text-muted-foreground px-2 pt-1 pb-0.5 uppercase tracking-wide">
            Hero theme
          </p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-muted transition-colors",
                theme === t.id && "bg-muted",
              )}
              aria-pressed={theme === t.id}
            >
              <span
                className={cn(
                  "w-4 h-4 rounded-full ring-2",
                  t.swatch,
                  theme === t.id ? "ring-foreground" : "ring-transparent",
                )}
                aria-hidden="true"
              />
              {t.label}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-accent flex items-center justify-center hover:opacity-90 transition-opacity"
        aria-label="Toggle hero theme"
        aria-expanded={open}
      >
        <Palette className="w-5 h-5" />
      </button>
    </div>
  );
};

export default HeroThemeSwitcher;
