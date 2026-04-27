import { test, expect } from "@playwright/test";
import { dismissOverlays, setTheme, stabilize } from "./helpers";

/**
 * Hero-specific snapshot — tighter than the full-page route shot.
 * Catches color/gradient regressions on the "Welcome to LinkUp" headline,
 * badge, feature icons, and CTA buttons across light/dark and
 * mobile/desktop breakpoints.
 */
test("homepage hero", async ({ page, colorScheme }) => {
  await dismissOverlays(page);
  await setTheme(page, colorScheme === "dark" ? "dark" : "light");
  await page.goto("/");

  const hero = page.locator('section[aria-labelledby="hero-heading"]');
  await hero.waitFor({ state: "visible" });

  // Wait for the hero background image so gradient overlays composite consistently.
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((r) => {
              img.onload = img.onerror = () => r(null);
            })
      )
    );
  });

  await stabilize(page);
  await expect(hero).toHaveScreenshot("hero.png");
});
