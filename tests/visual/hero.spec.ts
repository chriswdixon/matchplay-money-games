import { test } from "@playwright/test";
import { dismissOverlays, setTheme, snapshotElement, stabilize } from "./helpers";

/**
 * Hero-specific snapshot — tighter than the full-page route shot.
 * Uses the `strict` threshold preset so any real color / gradient
 * regression on "Welcome to LinkUp" trips the build, while normal
 * sub-pixel anti-aliasing stays under the bar.
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
  await snapshotElement(hero, "hero", { preset: "strict" });
});
