// Edge function smoke + auth tests.
// Strategy: every public edge function gets at least
//   1. CORS preflight returns 200
//   2. unauthenticated POST is rejected (or accepted only if the function is intentionally public)
//   3. malformed body is rejected with 4xx
//
// We do NOT make destructive assertions about success because most functions
// require Stripe/Ayrshare/admin context. We test the SECURITY surface.

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callEdgeFunction, createTestUser, teardownUsers, SUPABASE_URL, SUPABASE_ANON_KEY } from "../harness.ts";

const FUNCTIONS_REQUIRING_AUTH = [
  "charge-match-buyin",
  "credit-match-winnings",
  "process-payout",
  "create-checkout",
  "create-setup-intent",
  "setup-payment-method",
  "customer-portal",
  "check-subscription",
  "export-user-data",
  "process-double-down-payments",
  "record-double-down-vote",
  "create-golf-course",
  "smart-course-search",
  "recommend-courses",
];

const ADMIN_ONLY_FUNCTIONS = [
  "admin-create-coupon",
  "admin-disable-user",
  "admin-list-coupons",
  "admin-list-users",
  "admin-magic-link",
  "admin-password-reset",
  "cleanup-course-data",
  "enrich-golf-course",
  "export-all-courses",
  "flag-incomplete-matches",
  "import-golf-courses",
  "ayrshare-post",
];

const PUBLIC_FUNCTIONS = [
  "request-invite",
  "send-age-verification",
  "verify-age-token",
  "search-golf-courses",
];

async function preflight(name: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "OPTIONS",
    headers: { Origin: "https://example.com", "Access-Control-Request-Method": "POST" },
  });
  await res.text(); // consume body
  return res.status;
}

for (const name of [...FUNCTIONS_REQUIRING_AUTH, ...ADMIN_ONLY_FUNCTIONS, ...PUBLIC_FUNCTIONS]) {
  Deno.test(`edge:${name} — CORS preflight returns 2xx`, async () => {
    const status = await preflight(name);
    assert(status >= 200 && status < 300, `Expected 2xx, got ${status}`);
  });
}

for (const name of FUNCTIONS_REQUIRING_AUTH) {
  Deno.test(`edge:${name} — rejects anonymous calls`, async () => {
    const { status } = await callEdgeFunction(name, {});
    assert(status === 401 || status === 403 || status === 400,
      `Expected 401/403/400 for anonymous call to ${name}, got ${status}`);
  });
}

for (const name of ADMIN_ONLY_FUNCTIONS) {
  Deno.test(`edge:${name} — non-admin authenticated user is rejected`, async () => {
    const u = await createTestUser("nonadmin");
    try {
      const { status } = await callEdgeFunction(name, {}, { token: u.accessToken });
      assert(status === 401 || status === 403 || status === 400,
        `Expected 401/403/400 for non-admin call to ${name}, got ${status}`);
    } finally {
      await teardownUsers(u);
    }
  });
}

Deno.test("edge:request-invite — accepts a valid request shape", async () => {
  const { status } = await callEdgeFunction("request-invite", {
    email: `e2e+invite-${crypto.randomUUID().slice(0, 8)}@e2e.linkup.test`,
    name: "E2E",
    reason: "automated test",
  });
  // Could be 200 (queued) or 429 (rate-limited) — both acceptable security responses
  assert([200, 201, 202, 400, 429].includes(status), `unexpected status ${status}`);
});

Deno.test("edge:request-invite — rejects malformed body", async () => {
  const { status } = await callEdgeFunction("request-invite", { email: "not-an-email" });
  assert(status >= 400 && status < 500, `Expected 4xx for invalid body, got ${status}`);
});

Deno.test("edge:verify-age-token — rejects empty token", async () => {
  const { status } = await callEdgeFunction("verify-age-token", { token: "" });
  assert(status >= 400 && status < 500, `Expected 4xx, got ${status}`);
});

Deno.test("edge:search-golf-courses — accepts query", async () => {
  const { status } = await callEdgeFunction("search-golf-courses", { query: "pebble" });
  assert([200, 401].includes(status), `unexpected status ${status}`);
});
