import { vi } from "vitest";

/**
 * Lightweight Supabase client mock — chainable query builder.
 * Override behaviors per-test by replacing implementations.
 */
export interface MockResult<T = any> {
  data: T;
  error: any;
  count?: number | null;
}

export function createQueryBuilder(result: MockResult = { data: null, error: null }) {
  const builder: any = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    is: vi.fn(() => builder),
    or: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    like: vi.fn(() => builder),
    contains: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    match: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

export function createSupabaseMock(overrides: Partial<{
  user: any;
  session: any;
  fromResults: Record<string, MockResult>;
  rpcResults: Record<string, MockResult>;
  invokeResults: Record<string, MockResult>;
}> = {}) {
  const { user = null, session = null, fromResults = {}, rpcResults = {}, invokeResults = {} } = overrides;

  const authStateCallbacks: Array<(event: string, session: any) => void> = [];

  return {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session }, error: null })),
      getUser: vi.fn(() => Promise.resolve({ data: { user }, error: null })),
      signUp: vi.fn(() => Promise.resolve({ data: { user, session }, error: null })),
      signInWithPassword: vi.fn(() => Promise.resolve({ data: { user, session }, error: null })),
      signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ data: { url: "https://example.com" }, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      resend: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      onAuthStateChange: vi.fn((cb: any) => {
        authStateCallbacks.push(cb);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      _trigger: (event: string, sess: any) => authStateCallbacks.forEach((cb) => cb(event, sess)),
    },
    from: vi.fn((table: string) => createQueryBuilder(fromResults[table] ?? { data: [], error: null })),
    rpc: vi.fn((fn: string) => Promise.resolve(rpcResults[fn] ?? { data: null, error: null })),
    functions: {
      invoke: vi.fn((name: string) =>
        Promise.resolve(invokeResults[name] ?? { data: null, error: null })
      ),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
