import { Page, expect } from "@playwright/test";

/**
 * Make a page deterministic for visual regression:
 * - freeze time
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
      localStorage.setItem("linkup-cookie-consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, ts: Date.now() }));
      localStorage.setItem("linkup-install-prompt-dismissed", "1");
      localStorage.setItem("linkup-age-verified", "1");
    } catch {}
  });
}

export async function snapshot(page: Page, name: string) {
  await stabilize(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}
