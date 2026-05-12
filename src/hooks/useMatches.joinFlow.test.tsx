/**
 * Security regression tests: the frontend join flow MUST go through the
 * `validate_and_join_match` RPC and MUST NOT read raw PIN values from the
 * `matches` record. (Match record only exposes `team*_has_pin` booleans
 * and `team*_pin_creator` ids — never an actual PIN.)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ReactNode } from "react";

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/utils/supabaseMock");
  return {
    supabase: createSupabaseMock({
      user: { id: "user-1", email: "u@e.com" },
      session: { access_token: "t", user: { id: "user-1" } },
      rpcResults: {
        validate_and_join_match: {
          data: { success: true, message: "ok" },
          error: null,
        },
      },
    }),
  };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useMatches } from "@/hooks/useMatches";

const mock = supabase as any;
const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

function useAuthedMatches() {
  const auth = useAuth();
  const matches = useMatches();
  return { auth, matches };
}

describe("useMatches.joinMatch — secure RPC flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.rpc.mockImplementation((fn: string) =>
      Promise.resolve(
        fn === "validate_and_join_match"
          ? { data: { success: true, message: "ok" }, error: null }
          : { data: null, error: null }
      )
    );
  });

  it("invokes validate_and_join_match RPC with PIN + team args", async () => {
    const { result } = renderHook(() => useAuthedMatches(), { wrapper });
    await waitFor(() => expect(result.current.auth.user?.id).toBe("user-1"));

    await act(async () => {
      await result.current.matches.joinMatch("match-123", "1234", 2, "9999");
    });

    expect(mock.rpc).toHaveBeenCalledWith("validate_and_join_match", {
      p_match_id: "match-123",
      p_pin: "1234",
      p_team_number: 2,
      p_set_team_pin: "9999",
    });
  });

  it("never queries the matches table for PIN columns when joining", async () => {
    const { result } = renderHook(() => useAuthedMatches(), { wrapper });
    await waitFor(() => expect(result.current.auth.user?.id).toBe("user-1"));

    mock.from.mockClear();
    await act(async () => {
      await result.current.matches.joinMatch("match-123", "1234");
    });

    // Only the RPC should be used to join — no direct matches-table reads
    // happen inside joinMatch (refetch is debounced 500ms; we only assert
    // synchronous behavior of the join action itself).
    const fromCalls = (mock.from as any).mock.calls.map((c: any[]) => c[0]);
    expect(fromCalls).not.toContain("matches");
  });

  it("surfaces RPC-returned errors instead of joining locally", async () => {
    mock.rpc.mockImplementationOnce(() =>
      Promise.resolve({ data: { error: "Invalid PIN" }, error: null })
    );
    const { result } = renderHook(() => useAuthedMatches(), { wrapper });
    await waitFor(() => expect(result.current.auth.user?.id).toBe("user-1"));

    let res: any;
    await act(async () => {
      res = await result.current.matches.joinMatch("match-123", "0000");
    });
    expect(res.error).toBe("Invalid PIN");
  });
});

/**
 * Static source scan: no frontend file may reference real PIN value columns
 * on the matches record (`match.pin`, `match.team2_pin`, etc.). The only
 * allowed PIN-related fields are the booleans `team*_has_pin` and the
 * creator-id fields `team*_pin_creator`.
 */
describe("source scan — no raw PIN fields read from match record", () => {
  const SRC = join(process.cwd(), "src");
  const ALLOWED = /team[1-4]_(has_pin|pin_creator)\b/;
  // Forbidden patterns: `.pin` accessor on a match-like object, or
  // `team[1-4]_pin` not followed by `_creator` / not preceded by `has_`.
  const FORBIDDEN = [
    /\bmatch(es)?(\?\.|\.)pin\b/,
    /\bteam[1-4]_pin(?!_creator)(?!s\b)\b/,
  ];

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const s = statSync(p);
      if (s.isDirectory()) out.push(...walk(p));
      else if (/\.(ts|tsx)$/.test(name)) out.push(p);
    }
    return out;
  }

  const files = walk(SRC).filter(
    (f) =>
      !f.includes("/integrations/supabase/types.ts") &&
      !f.endsWith(".test.ts") &&
      !f.endsWith(".test.tsx") &&
      !f.endsWith(".spec.ts") &&
      !f.endsWith(".spec.tsx")
  );

  it("contains no forbidden raw-PIN field accesses", () => {
    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        // strip allowed tokens before testing forbidden patterns
        const stripped = line.replace(new RegExp(ALLOWED, "g"), "");
        for (const re of FORBIDDEN) {
          if (re.test(stripped)) {
            violations.push(`${file}:${i + 1}: ${line.trim()}`);
          }
        }
      });
    }
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
