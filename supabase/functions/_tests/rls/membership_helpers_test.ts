// Verifies that match-membership / role RPC helpers are not callable by
// anonymous users, and that authenticated users still get correct answers.

import { assertEquals, assert, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { anonClient, createTestUser, teardownUsers, type TestUser } from "../harness.ts";

let userA: TestUser;
let userB: TestUser;

async function setup() {
  if (!userA) userA = await createTestUser("memA");
  if (!userB) userB = await createTestUser("memB");
}

const HELPERS_DENIED_TO_ANON = [
  { fn: "is_user_in_match",          args: { p_match_id: crypto.randomUUID(), p_user_id: crypto.randomUUID() } },
  { fn: "is_user_match_participant", args: { p_match_id: crypto.randomUUID(), p_user_id: crypto.randomUUID() } },
  { fn: "is_match_participant",      args: { match_id:   crypto.randomUUID(), user_id:   crypto.randomUUID() } },
  { fn: "is_user_match_creator",     args: { p_match_id: crypto.randomUUID(), p_user_id: crypto.randomUUID() } },
  { fn: "has_role",                  args: { _user_id:   crypto.randomUUID(), _role: "admin" } },
  { fn: "realtime_topic_match_id",   args: { topic: `match:${crypto.randomUUID()}` } },
];

for (const { fn, args } of HELPERS_DENIED_TO_ANON) {
  Deno.test(`rpc:${fn} — anonymous caller is rejected`, async () => {
    const anon = anonClient();
    const { data, error } = await anon.rpc(fn, args);
    // Permission revoked from anon → expect explicit error (PostgREST 42501 / 404)
    assert(
      error !== null,
      `Anonymous rpc('${fn}') should fail; got data=${JSON.stringify(data)}`,
    );
  });
}

// ------------------------------------------------------------------
// Authenticated correctness
// ------------------------------------------------------------------

Deno.test("rpc:is_user_in_match — returns false for non-participant", async () => {
  await setup();
  const { data, error } = await userA.client.rpc("is_user_in_match", {
    p_match_id: crypto.randomUUID(),
    p_user_id: userA.userId,
  });
  assertEquals(error, null);
  assertEquals(data, false);
});

Deno.test("rpc:is_user_in_match — returns true for actual participant", async () => {
  await setup();
  // Create a match owned by A; A is auto-added as participant via app trigger,
  // but we insert participant explicitly to be deterministic.
  const { data: m, error: mErr } = await userA.client
    .from("matches")
    .insert({
      created_by: userA.userId,
      course_name: "Helper Test",
      location: "x",
      scheduled_time: new Date(Date.now() + 86400000).toISOString(),
      format: "Stroke Play",
      buy_in_amount: 0,
      max_participants: 4,
      status: "open",
    })
    .select()
    .single();
  assertEquals(mErr, null, `match insert: ${mErr?.message}`);
  assertExists(m);

  // Best-effort participant insert (may already exist via trigger)
  await userA.client.from("match_participants").insert({
    match_id: m!.id,
    user_id: userA.userId,
    status: "active",
  });

  const { data, error } = await userA.client.rpc("is_user_in_match", {
    p_match_id: m!.id,
    p_user_id: userA.userId,
  });
  assertEquals(error, null);
  assertEquals(data, true);

  // B is not a participant
  const { data: dataB } = await userB.client.rpc("is_user_in_match", {
    p_match_id: m!.id,
    p_user_id: userB.userId,
  });
  assertEquals(dataB, false);

  await userA.client.from("matches").delete().eq("id", m!.id);
});

Deno.test("rpc:is_user_in_match — NULL inputs return false (no leak)", async () => {
  await setup();
  const { data, error } = await userA.client.rpc("is_user_in_match", {
    p_match_id: null,
    p_user_id: null,
  });
  assertEquals(error, null);
  assertEquals(data, false);
});

Deno.test("rpc:has_role — non-admin user gets false", async () => {
  await setup();
  const { data, error } = await userA.client.rpc("has_role", {
    _user_id: userA.userId,
    _role: "admin",
  });
  assertEquals(error, null);
  assertEquals(data, false);
});

Deno.test("rpc:has_role — NULL inputs return false", async () => {
  await setup();
  const { data, error } = await userA.client.rpc("has_role", {
    _user_id: null,
    _role: "admin",
  });
  assertEquals(error, null);
  assertEquals(data, false);
});

Deno.test("rpc:realtime_topic_match_id — extracts uuid from valid topic", async () => {
  await setup();
  const id = crypto.randomUUID();
  const { data, error } = await userA.client.rpc("realtime_topic_match_id", {
    topic: `match:${id}:scores`,
  });
  assertEquals(error, null);
  assertEquals(data, id);
});

Deno.test("rpc:realtime_topic_match_id — rejects oversized topic input", async () => {
  await setup();
  const huge = "x".repeat(1024) + crypto.randomUUID();
  const { data, error } = await userA.client.rpc("realtime_topic_match_id", {
    topic: huge,
  });
  assertEquals(error, null);
  assertEquals(data, null);
});

Deno.test("rpc:realtime_topic_match_id — null topic returns null", async () => {
  await setup();
  const { data, error } = await userA.client.rpc("realtime_topic_match_id", {
    topic: null,
  });
  assertEquals(error, null);
  assertEquals(data, null);
});

// Cleanup at the end
Deno.test("rpc:membership_helpers — teardown", async () => {
  if (userA || userB) {
    await teardownUsers(...[userA, userB].filter(Boolean) as TestUser[]);
  }
});
