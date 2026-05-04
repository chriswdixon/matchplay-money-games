import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "@/components/ThemeProvider";
import { Sun, Moon, Monitor } from "lucide-react";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-primary" aria-hidden="true" />
          Appearance
        </CardTitle>
        <CardDescription>Choose how Tyche looks on this device.</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

export default AppearanceSettings;
