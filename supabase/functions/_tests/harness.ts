// Shared test harness for live edge-function and RLS tests.
// Creates disposable Supabase auth users and exposes helpers.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

export const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? "https://rgdegvpfnilzkqpexgij.supabase.co";
export const SUPABASE_ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZGVndnBmbmlsemtxcGV4Z2lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY3NjUsImV4cCI6MjA3MjQwMjc2NX0.k7Amb25bAU99bdgIAp6VlfBexLQ94HJYjjzV07f8QGw";

const TEST_PREFIX = "e2e";
const TEST_DOMAIN = "e2e.tyche.test";
const TEST_PASSWORD = "E2eTest!Pwd9aB"; // strong, passes app password schema

export interface TestUser {
  email: string;
  password: string;
  userId: string;
  client: SupabaseClient;
  accessToken: string;
}

const createdUserIds = new Set<string>();

export function freshClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createTestUser(label = "user"): Promise<TestUser> {
  const slug = `${label}-${crypto.randomUUID().slice(0, 8)}`;
  const email = `${TEST_PREFIX}+${slug}@${TEST_DOMAIN}`;
  const client = freshClient();
  const { data, error } = await client.auth.signUp({
    email,
    password: TEST_PASSWORD,
    options: {
      data: { display_name: `e2e-${slug}`, first_name: "E2E", last_name: "Test" },
    },
  });
  if (error) throw new Error(`Signup failed for ${email}: ${error.message}`);
  if (!data.user || !data.session) {
    throw new Error(`Signup returned no session for ${email} — confirm email is disabled in Auth settings`);
  }
  createdUserIds.add(data.user.id);
  return {
    email,
    password: TEST_PASSWORD,
    userId: data.user.id,
    client,
    accessToken: data.session.access_token,
  };
}

export async function signOutUser(u: TestUser) {
  try {
    await u.client.auth.signOut();
  } catch {
    /* ignore */
  }
}

export async function teardownUsers(...users: TestUser[]) {
  for (const u of users) await signOutUser(u);
}

export async function callEdgeFunction(
  name: string,
  body: unknown,
  opts: { token?: string; method?: string } = {},
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: opts.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = await res.text().catch(() => null);
  }
  return { status: res.status, data };
}

export const TEST_PASSWORD_VALUE = TEST_PASSWORD;
