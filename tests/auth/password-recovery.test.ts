import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openRecoverySession } from "@/lib/auth/password-recovery";

const { setSession, getUser, createClient } = vi.hoisted(() => ({ setSession: vi.fn(), getUser: vi.fn(), createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("isolated password recovery", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-key");
    createClient.mockReturnValue({ auth: { setSession, getUser } });
    setSession.mockResolvedValue({ data: { session: { user: { id: "user" } } }, error: null });
    getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
  });
  it.each(["", "#type=signup&access_token=a&refresh_token=b", "#type=recovery&error=access_denied", "#type=recovery&access_token=a"])("rejects missing or non-recovery credentials: %s", async (hash) => {
    await expect(openRecoverySession(hash)).rejects.toThrow();
    expect(setSession).not.toHaveBeenCalled();
  });
  it("verifies recovery credentials without persisting or replacing the normal login", async () => {
    await openRecoverySession("#type=recovery&access_token=a&refresh_token=b");
    expect(createClient).toHaveBeenCalledWith(expect.any(String), expect.any(String), expect.objectContaining({ auth: expect.objectContaining({ persistSession: false, detectSessionInUrl: false, autoRefreshToken: false }) }));
    expect(setSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "b" });
    expect(getUser).toHaveBeenCalled();
  });
  it("rejects expired credentials", async () => {
    setSession.mockResolvedValue({ data: { session: null }, error: new Error("expired") });
    await expect(openRecoverySession("#type=recovery&access_token=a&refresh_token=b")).rejects.toThrow();
  });
  it("rejects a session whose user cannot be verified", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("deleted") });
    await expect(openRecoverySession("#type=recovery&access_token=a&refresh_token=b")).rejects.toThrow();
  });
  it("fails safely when Auth is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(openRecoverySession("#type=recovery&access_token=a&refresh_token=b")).rejects.toThrow();
    expect(createClient).not.toHaveBeenCalled();
  });
});
