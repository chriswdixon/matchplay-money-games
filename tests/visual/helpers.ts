import { Page, Locator, expect } from "@playwright/test";
import { THRESHOLDS, type ThresholdPreset } from "./thresholds";

/**
 * Make a page deterministic for visual regression:
 * - disable animations & transitions
 * - hide volatile elements (toasts, live timers, randomized avatars)
 * - wait for fonts and network idle
 */
export async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      [data-testid="live-timer"],
      [data-volatile],
      .sonner-toast,
      [data-sonner-toaster] {
        visibility: hidden !important;
      }
    `,
  });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForLoadState("networkidle").catch(() => {});
}

/**
 * Set the app's theme by writing the storage key the ThemeProvider reads,
 * then reload so the class is applied before paint.
 */
export async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("vite-ui-theme", t);
      localStorage.setItem("linkup-theme", t);
    } catch {}
  }, theme);
}

/**
 * Dismiss persistent overlays (cookie banner, install prompt) that would
 * otherwise dominate every screenshot.
 */
export async function dismissOverlays(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        "linkup-cookie-consent",
        JSON.stringify({ necessary: true, analytics: false, marketing: false, ts: Date.now() })
      );
      localStorage.setItem("linkup-age-verified", "1");
    } catch {}
  });
}

/**
 * Full-page snapshot with a named threshold preset.
 *
 *   await snapshot(page, "home");                    // default tolerance
 *   await snapshot(page, "home", { preset: "strict" });
 */
export async function snapshot(
  page: Page,
  name: string,
  opts: { preset?: ThresholdPreset } = {}
) {
  await stabilize(page);
  const preset = THRESHOLDS[opts.preset ?? "default"];
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, ...preset });
}

/**
 * Element-scoped snapshot with a named threshold preset. Prefer this for
 * brand-critical regions (hero, primary CTAs) where `strict` makes sense.
 */
export async function snapshotElement(
  locator: Locator,
  name: string,
  opts: { preset?: ThresholdPreset } = {}
) {
  const preset = THRESHOLDS[opts.preset ?? "default"];
  await expect(locator).toHaveScreenshot(`${name}.png`, preset);
}
