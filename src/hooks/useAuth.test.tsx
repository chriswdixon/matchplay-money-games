import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ReactNode } from "react";

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseMock } = await import("@/test/utils/supabaseMock");
  return { supabase: createSupabaseMock() };
});
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
const mock = supabase as any;

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when used outside AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/within an AuthProvider/);
  });

  it("initializes with no session, loading=false after init", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("signUp delegates to supabase.auth.signUp with redirect + metadata", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signUp("u@e.com", "Pw0rd!Aa", "Disp", "First", "Last");
    });
    expect(mock.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: "u@e.com",
      password: "Pw0rd!Aa",
      options: expect.objectContaining({
        emailRedirectTo: expect.stringContaining("/verify"),
        data: expect.objectContaining({ display_name: "Disp", first_name: "First", last_name: "Last" }),
      }),
    }));
  });

  it("signIn calls signInWithPassword", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.signIn("u@e.com", "pw"); });
    expect(mock.auth.signInWithPassword).toHaveBeenCalledWith({ email: "u@e.com", password: "pw" });
  });

  it("signInWithMagicLink calls signInWithOtp", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.signInWithMagicLink("u@e.com"); });
    expect(mock.auth.signInWithOtp).toHaveBeenCalled();
  });

  it("signInWithProvider calls OAuth", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.signInWithProvider("google"); });
    expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider: "google" }));
  });

  it("signOut calls auth.signOut", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.signOut(); });
    expect(mock.auth.signOut).toHaveBeenCalled();
  });

  it("resendConfirmationEmail uses 'signup' type", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.resendConfirmationEmail("u@e.com"); });
    expect(mock.auth.resend).toHaveBeenCalledWith(expect.objectContaining({ type: "signup", email: "u@e.com" }));
  });

  it("rejects sessions with malformed JWT and signs out", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      mock.auth._trigger("SIGNED_IN", { access_token: "not-a-jwt", user: { id: "1" } });
    });
    expect(mock.auth.signOut).toHaveBeenCalled();
  });
});
