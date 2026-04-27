import { test } from "@playwright/test";
import { dismissOverlays, setTheme, snapshot } from "./helpers";

/**
 * Public, unauthenticated screens. No login required.
 * The Playwright project (light/dark, mobile/desktop) controls
 * viewport + color scheme, and we sync the app's theme storage to match.
 */
const ROUTES: Array<{ name: string; path: string }> = [
  { name: "home", path: "/" },
  { name: "landing", path: "/linkup" },
  { name: "auth", path: "/auth" },
  { name: "privacy", path: "/privacy" },
  { name: "terms", path: "/terms" },
];

for (const { name, path } of ROUTES) {
  test(`public route: ${name}`, async ({ page, colorScheme }) => {
    await dismissOverlays(page);
    await setTheme(page, colorScheme === "dark" ? "dark" : "light");
    await page.goto(path);
    await snapshot(page, name);
  });
}
