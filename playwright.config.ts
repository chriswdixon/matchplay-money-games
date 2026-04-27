import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for visual regression testing.
 *
 * Run:
 *   bun run test:visual              # run all visual tests
 *   bun run test:visual:update       # update baseline screenshots
 *
 * Baselines are stored next to each test file in __screenshots__/.
 * They are platform-specific (Linux baselines won't match macOS pixels);
 * commit the Linux ones produced by CI as the source of truth.
 */
export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 60_000,
  expect: {
    // Allow tiny anti-aliasing diffs; fail on real visual changes.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    video: "off",
    screenshot: "only-on-failure",
    colorScheme: "light",
  },
  projects: [
    {
      name: "desktop-light",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, colorScheme: "light" },
    },
    {
      name: "desktop-dark",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, colorScheme: "dark" },
    },
    {
      name: "tablet-light",
      use: { ...devices["iPad (gen 7)"], colorScheme: "light" },
    },
    {
      name: "mobile-light",
      use: { ...devices["iPhone 13"], colorScheme: "light" },
    },
    {
      name: "mobile-dark",
      use: { ...devices["iPhone 13"], colorScheme: "dark" },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "bun run dev",
        url: "http://localhost:8080",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
