import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon, Monitor } from "lucide-react";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
          <Sun className="w-5 h-5 text-primary" aria-hidden="true" />
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground mt-1.5">Choose how Tyche looks on this device.</p>
      </div>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(v) => v && setTheme(v as "light" | "dark" | "system")}
        className="justify-start"
        aria-label="Color theme"
      >
        <ToggleGroupItem value="light" aria-label="Light mode" className="gap-2">
          <Sun className="h-4 w-4" aria-hidden="true" />
          Light
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label="Dark mode" className="gap-2">
          <Moon className="h-4 w-4" aria-hidden="true" />
          Dark
        </ToggleGroupItem>
        <ToggleGroupItem value="system" aria-label="Match system" className="gap-2">
          <Monitor className="h-4 w-4" aria-hidden="true" />
          System
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

export default AppearanceSettings;
