import { test } from "@playwright/test";
import { dismissOverlays, setTheme, snapshot } from "./helpers";

/**
 * Authenticated screens (home dashboard, create match, scorecard, admin console).
 *
 * These require a logged-in session. Provide test credentials via env:
 *   PLAYWRIGHT_TEST_EMAIL, PLAYWRIGHT_TEST_PASSWORD
 *   PLAYWRIGHT_ADMIN_EMAIL, PLAYWRIGHT_ADMIN_PASSWORD (for /admin)
 *
 * If credentials are not set, the auth-only specs are skipped so the
 * suite stays green on machines that don't have test accounts wired up.
 */

const USER_EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL;
const USER_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD;
const ADMIN_EMAIL = process.env.PLAYWRIGHT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD;

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 15_000 });
}

test.describe("authenticated screens", () => {
  test.skip(!USER_EMAIL || !USER_PASSWORD, "Set PLAYWRIGHT_TEST_EMAIL/PASSWORD to run");

  test.beforeEach(async ({ page, colorScheme }) => {
    await dismissOverlays(page);
    await setTheme(page, colorScheme === "dark" ? "dark" : "light");
    await login(page, USER_EMAIL!, USER_PASSWORD!);
  });

  test("home dashboard", async ({ page }) => {
    await page.goto("/");
    await snapshot(page, "home-dashboard");
  });

  test("create match", async ({ page }) => {
    await page.goto("/create-match");
    await snapshot(page, "create-match");
  });

  test("profile", async ({ page }) => {
    await page.goto("/profile");
    await snapshot(page, "profile");
  });
});

test.describe("scorecard", () => {
  test.skip(!process.env.PLAYWRIGHT_MATCH_ID || !USER_EMAIL, "Set PLAYWRIGHT_MATCH_ID + test creds");

  test("active scorecard", async ({ page, colorScheme }) => {
    await dismissOverlays(page);
    await setTheme(page, colorScheme === "dark" ? "dark" : "light");
    await login(page, USER_EMAIL!, USER_PASSWORD!);
    await page.goto(`/match/${process.env.PLAYWRIGHT_MATCH_ID}`);
    await snapshot(page, "scorecard");
  });
});

test.describe("admin console", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set PLAYWRIGHT_ADMIN_EMAIL/PASSWORD to run");

  test("admin console", async ({ page, colorScheme }) => {
    await dismissOverlays(page);
    await setTheme(page, colorScheme === "dark" ? "dark" : "light");
    await login(page, ADMIN_EMAIL!, ADMIN_PASSWORD!);
    await page.goto("/admin");
    await snapshot(page, "admin-console");
  });
});
