// RLS policy matrix — verifies that every protected table denies cross-user
// access for SELECT, INSERT, UPDATE, DELETE as appropriate.
//
// Strategy: create two real auth users (A, B) and an anonymous client.
// For each table:
//   - A inserts (or seeds) a row owned by A
//   - B's client must NOT see / mutate / delete A's row
//   - Anonymous client must NOT access anything
//   - A's own access works for owner-scoped operations

import { assertEquals, assert, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { anonClient, createTestUser, teardownUsers, type TestUser } from "../harness.ts";

let userA: TestUser;
let userB: TestUser;

async function setup() {
  if (!userA) userA = await createTestUser("rlsA");
  if (!userB) userB = await createTestUser("rlsB");
}

// ============================================================
// profiles
// ============================================================
Deno.test("rls:profiles — anonymous cannot read profiles", async () => {
  await setup();
  const anon = anonClient();
  const { data, error } = await anon.from("profiles").select("*").limit(1);
  // Either explicit error OR empty data (RLS denies invisibly)
  assert(error !== null || (data ?? []).length === 0, "Anonymous should not see profiles");
});

Deno.test("rls:profiles — user can read own profile", async () => {
  await setup();
  const { data, error } = await userA.client.from("profiles").select("*").eq("user_id", userA.userId);
  assertEquals(error, null);
  // Profile may or may not auto-exist depending on triggers; just assert no permission error
  assert(Array.isArray(data));
});

Deno.test("rls:profiles — user B cannot update user A's profile", async () => {
  await setup();
  // Ensure A has a profile
  await userA.client.from("profiles").upsert({ user_id: userA.userId, display_name: "A-original" });
  const { error, data } = await userB.client
    .from("profiles")
    .update({ display_name: "hacked" })
    .eq("user_id", userA.userId)
    .select();
  // RLS should either error or return empty data
  assert(error !== null || (data ?? []).length === 0, "B should not be able to update A's profile");
});

Deno.test("rls:profiles — user cannot insert profile for another user_id", async () => {
  await setup();
  const { error } = await userA.client.from("profiles").insert({
    user_id: userB.userId,
    display_name: "stolen",
  });
  assertExists(error, "Insert with wrong user_id should be denied by RLS");
});

// ============================================================
// private_profile_data
// ============================================================
Deno.test("rls:private_profile_data — user B cannot read user A's private data", async () => {
  await setup();
  await userA.client.from("private_profile_data").upsert({
    user_id: userA.userId,
    membership_tier: "Free",
  });
  const { data } = await userB.client
    .from("private_profile_data")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0, "B must not see A's private profile data");
});

Deno.test("rls:private_profile_data — user cannot insert with another user_id", async () => {
  await setup();
  const { error } = await userA.client.from("private_profile_data").insert({
    user_id: userB.userId,
    membership_tier: "Pro",
  });
  assertExists(error);
});

// ============================================================
// matches
// ============================================================
Deno.test("rls:matches — user can create their own match", async () => {
  await setup();
  const { data, error } = await userA.client
    .from("matches")
    .insert({
      created_by: userA.userId,
      course_name: "E2E Test Course",
      location: "Test Location",
      scheduled_time: new Date(Date.now() + 86400000).toISOString(),
      format: "Stroke Play",
      buy_in_amount: 0,
      max_participants: 4,
      status: "open",
    })
    .select()
    .single();
  assertEquals(error, null, `Match insert error: ${error?.message}`);
  assertExists(data);
  // cleanup
  if (data) await userA.client.from("matches").delete().eq("id", data.id);
});

Deno.test("rls:matches — user cannot insert match with another user as creator", async () => {
  await setup();
  const { error } = await userA.client.from("matches").insert({
    created_by: userB.userId,
    course_name: "Spoofed",
    location: "x",
    scheduled_time: new Date(Date.now() + 86400000).toISOString(),
    format: "Stroke Play",
    buy_in_amount: 0,
    max_participants: 4,
  });
  assertExists(error, "Cannot create match impersonating another user");
});

Deno.test("rls:matches — non-creator non-participant cannot UPDATE match", async () => {
  await setup();
  const { data: m } = await userA.client
    .from("matches")
    .insert({
      created_by: userA.userId,
      course_name: "RLS Update Test",
      location: "x",
      scheduled_time: new Date(Date.now() + 86400000).toISOString(),
      format: "Stroke Play",
      buy_in_amount: 0,
      max_participants: 4,
      status: "open",
    })
    .select()
    .single();
  assertExists(m);
  const { data: updated } = await userB.client
    .from("matches")
    .update({ course_name: "HACKED" })
    .eq("id", m!.id)
    .select();
  assertEquals((updated ?? []).length, 0, "B should not be able to update A's match");
  // cleanup
  await userA.client.from("matches").delete().eq("id", m!.id);
});

Deno.test("rls:matches — non-participant cannot DELETE match", async () => {
  await setup();
  const { data: m } = await userA.client
    .from("matches")
    .insert({
      created_by: userA.userId,
      course_name: "RLS Delete Test",
      location: "x",
      scheduled_time: new Date(Date.now() + 86400000).toISOString(),
      format: "Stroke Play",
      buy_in_amount: 0,
      max_participants: 4,
      status: "open",
    })
    .select()
    .single();
  assertExists(m);
  const { error } = await userB.client.from("matches").delete().eq("id", m!.id);
  // Either error or no rows affected — verify A's match still exists
  const { data: stillThere } = await userA.client.from("matches").select("id").eq("id", m!.id);
  assertEquals((stillThere ?? []).length, 1, "B should not be able to delete A's match");
  await userA.client.from("matches").delete().eq("id", m!.id);
});

// ============================================================
// user_roles — privilege escalation guard
// ============================================================
Deno.test("rls:user_roles — user cannot grant themselves admin", async () => {
  await setup();
  const { error } = await userA.client.from("user_roles").insert({
    user_id: userA.userId,
    role: "admin",
  });
  assertExists(error, "Self-promotion to admin must be denied by RLS");
});

Deno.test("rls:user_roles — user cannot grant another user a role", async () => {
  await setup();
  const { error } = await userA.client.from("user_roles").insert({
    user_id: userB.userId,
    role: "moderator",
  });
  assertExists(error);
});

Deno.test("rls:user_roles — user cannot UPDATE roles", async () => {
  await setup();
  const { data, error } = await userA.client
    .from("user_roles")
    .update({ role: "admin" })
    .eq("user_id", userA.userId)
    .select();
  // Either explicit denial or zero rows
  assert(error !== null || (data ?? []).length === 0);
});

// ============================================================
// account_transactions
// ============================================================
Deno.test("rls:account_transactions — user B cannot read A's transactions", async () => {
  await setup();
  const { data } = await userB.client
    .from("account_transactions")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0);
});

Deno.test("rls:account_transactions — user cannot INSERT (service-role only)", async () => {
  await setup();
  const { error } = await userA.client.from("account_transactions").insert({
    user_id: userA.userId,
    account_id: crypto.randomUUID(),
    description: "spoof",
    transaction_type: "deposit",
    amount: 999_999,
  });
  assertExists(error, "Direct user inserts to account_transactions must be denied");
});

// ============================================================
// player_accounts
// ============================================================
Deno.test("rls:player_accounts — user B cannot view A's account", async () => {
  await setup();
  await userA.client.from("player_accounts").upsert({ user_id: userA.userId, balance: 0 });
  const { data } = await userB.client
    .from("player_accounts")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0);
});

Deno.test("rls:player_accounts — user cannot UPDATE balance directly", async () => {
  await setup();
  const { data } = await userA.client
    .from("player_accounts")
    .update({ balance: 1_000_000 })
    .eq("user_id", userA.userId)
    .select();
  assertEquals((data ?? []).length, 0, "Direct balance update must be denied");
});

// ============================================================
// favorite_courses
// ============================================================
Deno.test("rls:favorite_courses — user B cannot read A's favorites", async () => {
  await setup();
  await userA.client.from("favorite_courses").insert({
    user_id: userA.userId,
    course_name: "A's Favorite",
  });
  const { data } = await userB.client
    .from("favorite_courses")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0);
});

Deno.test("rls:favorite_courses — limit of 5 per user is enforced", async () => {
  await setup();
  await userA.client.from("favorite_courses").delete().eq("user_id", userA.userId);
  for (let i = 0; i < 5; i++) {
    const { error } = await userA.client.from("favorite_courses").insert({
      user_id: userA.userId,
      course_name: `Course ${i}`,
    });
    assertEquals(error, null);
  }
  const { error: sixth } = await userA.client.from("favorite_courses").insert({
    user_id: userA.userId,
    course_name: "Sixth",
  });
  assertExists(sixth, "6th favorite should be denied by RLS WITH CHECK count");
  // cleanup
  await userA.client.from("favorite_courses").delete().eq("user_id", userA.userId);
});

// ============================================================
// blocked_states — public read, admin-only write
// ============================================================
Deno.test("rls:blocked_states — anonymous can READ active states", async () => {
  const anon = anonClient();
  const { error } = await anon.from("blocked_states").select("*").eq("is_active", true);
  assertEquals(error, null);
});

Deno.test("rls:blocked_states — non-admin cannot INSERT", async () => {
  await setup();
  const { error } = await userA.client.from("blocked_states").insert({
    state_code: "ZZ",
    state_name: "Test",
    is_active: true,
  });
  assertExists(error);
});

// ============================================================
// social_links — public read, admin write
// ============================================================
Deno.test("rls:social_links — anonymous can read active links", async () => {
  const anon = anonClient();
  const { error } = await anon.from("social_links").select("*").eq("is_active", true);
  assertEquals(error, null);
});

Deno.test("rls:social_links — non-admin cannot INSERT", async () => {
  await setup();
  const { error } = await userA.client.from("social_links").insert({
    platform: "test",
    url: "https://example.com",
  });
  assertExists(error);
});

// ============================================================
// invites — admin-only
// ============================================================
Deno.test("rls:invites — non-admin cannot read invites", async () => {
  await setup();
  const { data } = await userA.client.from("invites").select("*");
  assertEquals((data ?? []).length, 0);
});

Deno.test("rls:invites — non-admin cannot create invites", async () => {
  await setup();
  const { error } = await userA.client.from("invites").insert({
    code: "TESTCODE1",
    created_by: userA.userId,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
  assertExists(error);
});

// ============================================================
// admin_access_log — admin-only read
// ============================================================
Deno.test("rls:admin_access_log — non-admin cannot read", async () => {
  await setup();
  const { data } = await userA.client.from("admin_access_log").select("*");
  assertEquals((data ?? []).length, 0);
});

// ============================================================
// account_deletion_requests
// ============================================================
Deno.test("rls:account_deletion_requests — user B cannot read A's requests", async () => {
  await setup();
  await userA.client.from("account_deletion_requests").insert({
    user_id: userA.userId,
    reason: "test",
  });
  const { data } = await userB.client
    .from("account_deletion_requests")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0);
});

Deno.test("rls:account_deletion_requests — user cannot file request for another user", async () => {
  await setup();
  const { error } = await userA.client.from("account_deletion_requests").insert({
    user_id: userB.userId,
    reason: "malicious",
  });
  assertExists(error);
});

// ============================================================
// consent_records
// ============================================================
Deno.test("rls:consent_records — user B cannot read A's consents", async () => {
  await setup();
  await userA.client.from("consent_records").insert({
    user_id: userA.userId,
    consent_type: "cookies",
    consented: true,
  });
  const { data } = await userB.client
    .from("consent_records")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0);
});

Deno.test("rls:consent_records — user cannot insert for another user", async () => {
  await setup();
  const { error } = await userA.client.from("consent_records").insert({
    user_id: userB.userId,
    consent_type: "cookies",
    consented: true,
  });
  assertExists(error);
});

// ============================================================
// pin_attempts
// ============================================================
Deno.test("rls:pin_attempts — user B cannot view A's attempts", async () => {
  await setup();
  const { data } = await userB.client
    .from("pin_attempts")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0);
});

// ============================================================
// double_down_participants
// ============================================================
Deno.test("rls:double_down_participants — user B cannot view A's data", async () => {
  await setup();
  const { data } = await userB.client
    .from("double_down_participants")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0);
});

Deno.test("rls:double_down_participants — user cannot insert for another user", async () => {
  await setup();
  const { error } = await userA.client.from("double_down_participants").insert({
    user_id: userB.userId,
    match_id: crypto.randomUUID(),
    opted_in: true,
  });
  assertExists(error);
});

// ============================================================
// profile_audit_log
// ============================================================
Deno.test("rls:profile_audit_log — direct insert is denied", async () => {
  await setup();
  const { error } = await userA.client.from("profile_audit_log").insert({
    user_id: userA.userId,
    action: "spoof",
  });
  assertExists(error);
});

Deno.test("rls:profile_audit_log — user B cannot read A's audit log", async () => {
  await setup();
  const { data } = await userB.client
    .from("profile_audit_log")
    .select("*")
    .eq("user_id", userA.userId);
  assertEquals((data ?? []).length, 0);
});

// ============================================================
// age_verification_tokens
// ============================================================
Deno.test("rls:age_verification_tokens — direct insert is denied", async () => {
  await setup();
  const { error } = await userA.client.from("age_verification_tokens").insert({
    user_id: userA.userId,
    email: "fake@example.com",
    token: "fake",
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  assertExists(error, "Direct token insert must be denied (service role only)");
});

// ============================================================
// match_join_tokens
// ============================================================
Deno.test("rls:match_join_tokens — direct insert is denied", async () => {
  await setup();
  const { error } = await userA.client.from("match_join_tokens").insert({
    match_id: crypto.randomUUID(),
    team_number: 1,
    token: "x",
    created_by: userA.userId,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
  });
  // Policy uses WITH CHECK true on service_role only — auth users should fail
  assert(error !== null, "Direct token insert by auth user must fail");
});

// ============================================================
// Anonymous coverage — every protected table denies anon SELECT
// ============================================================
const PROTECTED_TABLES = [
  "profiles",
  "private_profile_data",
  "matches",
  "match_participants",
  "match_scores",
  "match_results",
  "match_confirmations",
  "match_join_tokens",
  "match_cancellation_confirmations",
  "match_cancellation_reviews",
  "incomplete_match_reviews",
  "double_down_participants",
  "favorite_courses",
  "golf_courses",
  "user_roles",
  "invites",
  "account_transactions",
  "player_accounts",
  "player_ratings",
  "consent_records",
  "account_deletion_requests",
  "admin_access_log",
  "pin_attempts",
  "profile_audit_log",
  "age_verification_tokens",
];

for (const table of PROTECTED_TABLES) {
  Deno.test(`rls:anon — ${table} returns no rows to anonymous client`, async () => {
    const anon = anonClient();
    const { data, error } = await anon.from(table).select("*").limit(1);
    // RLS for anon should result in error OR empty array
    assert(error !== null || (data ?? []).length === 0,
      `Anonymous SELECT on ${table} should be denied; got ${(data ?? []).length} rows`);
  });
}

// ============================================================
// Final teardown
// ============================================================
Deno.test({
  name: "rls:teardown — sign out test users",
  fn: async () => {
    if (userA) await teardownUsers(userA);
    if (userB) await teardownUsers(userB);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
