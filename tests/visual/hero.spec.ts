import { test } from "@playwright/test";
import { dismissOverlays, setTheme, stabilize } from "./helpers";

/**
 * Hero-specific snapshot — tighter than the full-page route shot.
 * Catches color/gradient regressions on the "Welcome to LinkUp" headline
 * and the badge row across light/dark and mobile/desktop breakpoints.
 */
test("homepage hero", async ({ page, colorScheme }, testInfo) => {
  await dismissOverlays(page);
  await setTheme(page, colorScheme === "dark" ? "dark" : "light");
  await page.goto("/");

  const hero = page.locator('section[aria-labelledby="hero-heading"]');
  await hero.waitFor({ state: "visible" });

  // Wait for hero background image to finish loading so gradient overlays
  // are composited consistently.
  await page.evaluate(async () => {
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete ? Promise.resolve() : new Promise((r) => (img.onload = img.onerror = r))
      )
    );
  });

  await stabilize(page);
  await testInfo.attach("viewport", { body: JSON.stringify(page.viewportSize()), contentType: "application/json" });

  // Element-scoped screenshot — bounded to the hero, ignores below-the-fold churn.
  await hero.screenshot({ path: testInfo.outputPath("hero.png") }); // for debugging
  await import("@playwright/test").then(({ expect }) =>
    expect(hero).toHaveScreenshot("hero.png")
  );
});
