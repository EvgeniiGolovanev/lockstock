import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth, api } = vi.hoisted(() => ({
  auth: { signInWithOAuth: vi.fn(), getSession: vi.fn(), updateUser: vi.fn() },
  api: vi.fn()
}));
vi.mock("@/lib/supabase-browser", () => ({ getSupabaseBrowserClient: () => ({ auth }) }));
vi.mock("@/lib/api/browser-request", () => ({ browserApiRequest: api }));
import { startGoogleSignIn, finishGoogleSignIn, loadGoogleOnboarding, completeGoogleOnboarding, safeGoogleReturnPath } from "@/lib/auth/google";

const session = { access_token: "google-token", user: { id: "user-1", user_metadata: { full_name: "Jane" } } };
const callback = "http://localhost/auth/callback#access_token=google-token&refresh_token=refresh&token_type=bearer";

describe("Google sign in", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear(); localStorage.clear();
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com" }, error: null });
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    auth.updateUser.mockResolvedValue({ error: null });
    api.mockResolvedValue({ data: [] });
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/auth/callback", "/api/health", "/inventory/../auth/callback"])("rejects unsafe return path %s", value => {
    expect(safeGoogleReturnPath(value)).toBe("/inventory");
  });
  it("keeps the payment plan and interval", () => {
    expect(safeGoogleReturnPath("/payment?plan=business&interval=annual")).toBe("/payment?plan=business&interval=annual");
  });
  it("starts Google without requiring email or password", async () => {
    await startGoogleSignIn({ returnTo: "/payment?interval=annual", company: "Factory" });
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } });
  });
  it("retains a selected workspace only if the signed-in user belongs to it", async () => {
    await startGoogleSignIn({ returnTo: "/payment?interval=annual" });
    localStorage.setItem("lockstock.orgId", "other-account-org");
    api.mockResolvedValue({ data: [{ organization: { id: "my-org" } }] });
    expect(await finishGoogleSignIn(callback)).toBe("/payment?interval=annual");
    expect(localStorage.getItem("lockstock.orgId")).toBe("my-org");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("preserves an existing selected membership", async () => {
    await startGoogleSignIn();
    localStorage.setItem("lockstock.orgId", "second");
    api.mockResolvedValue({ data: [{ organization: { id: "first" } }, { organization: { id: "second" } }] });
    expect(await finishGoogleSignIn(callback)).toBe("/inventory");
    expect(localStorage.getItem("lockstock.orgId")).toBe("second");
  });
  it("routes a new user to onboarding and clears stale workspace state", async () => {
    await startGoogleSignIn({ company: "Factory", selectedPlan: "business", onboardingMode: "paid" });
    localStorage.setItem("lockstock.orgId", "stale");
    expect(await finishGoogleSignIn(callback)).toBe("/auth/complete");
    expect(localStorage.getItem("lockstock.orgId")).toBeNull();
    expect(await loadGoogleOnboarding()).toMatchObject({ fullName: "Jane", company: "Factory", selectedPlan: "business", onboardingMode: "paid" });
  });
  it.each(["#error=access_denied", "?error=access_denied", "", "#access_token=other&refresh_token=r"])("does not use an old session on a failed callback %s", async suffix => {
    await startGoogleSignIn();
    await expect(finishGoogleSignIn(`http://localhost/auth/callback${suffix}`)).rejects.toThrow();
    expect(api).not.toHaveBeenCalled();
  });
  it("rejects unsolicited callbacks", async () => {
    await expect(finishGoogleSignIn(callback)).rejects.toThrow();
  });
  it("does not interpret a membership outage as a new user", async () => {
    await startGoogleSignIn(); api.mockRejectedValue(new Error("offline"));
    await expect(finishGoogleSignIn(callback)).rejects.toThrow("offline");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("starts a trial only after the user completes their company details", async () => {
    await startGoogleSignIn();
    api.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: { orgId: "new-org" } });
    expect(await completeGoogleOnboarding({ fullName: "Jane", company: "Factory", onboardingMode: "trial", selectedPlan: "starter" })).toBe("/account");
    expect(api).toHaveBeenLastCalledWith("/api/billing/start-trial", expect.objectContaining({ method: "POST" }));
    expect(localStorage.getItem("lockstock.orgId")).toBe("new-org");
  });
  it("does not start a trial for a paid signup", async () => {
    await startGoogleSignIn({ returnTo: "/payment?interval=annual" });
    expect(await completeGoogleOnboarding({ fullName: "Jane", company: "Factory", onboardingMode: "paid", selectedPlan: "business" })).toBe("/payment?onboarding=paid&plan=business&interval=annual");
    expect(api).toHaveBeenCalledTimes(1);
  });
  it("does not restart trials or overwrite profiles when onboarding is revisited", async () => {
    api.mockResolvedValue({ data: [{ organization: { id: "existing" } }] });
    expect(await completeGoogleOnboarding({ fullName: "Jane", company: "Factory", onboardingMode: "trial", selectedPlan: "starter" })).toBe("/inventory");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("clears pending intent when the provider cannot start", async () => {
    auth.signInWithOAuth.mockResolvedValue({ error: new Error("provider disabled") });
    await expect(startGoogleSignIn()).rejects.toThrow("provider disabled");
    expect(sessionStorage.getItem("lockstock.google-intent")).toBeNull();
  });
  it("requires a session before onboarding", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(loadGoogleOnboarding()).rejects.toThrow("google.failed");
    expect(api).not.toHaveBeenCalled();
  });
  it("ignores malformed or expired intent", async () => {
    sessionStorage.setItem("lockstock.google-intent", "invalid json");
    await expect(finishGoogleSignIn(callback)).rejects.toThrow();
    await startGoogleSignIn();
    const intent = JSON.parse(sessionStorage.getItem("lockstock.google-intent")!);
    sessionStorage.setItem("lockstock.google-intent", JSON.stringify({ ...intent, createdAt: Date.now() - 31 * 60_000 }));
    await expect(finishGoogleSignIn(callback)).rejects.toThrow();
  });
  it("does not activate a trial when updating the profile fails", async () => {
    auth.updateUser.mockResolvedValue({ error: new Error("offline") });
    await expect(completeGoogleOnboarding({ fullName: "Jane", company: "Factory", onboardingMode: "trial", selectedPlan: "starter" })).rejects.toThrow("offline");
    expect(api).toHaveBeenCalledTimes(1);
  });
  it("rejects blank company details", async () => {
    await expect(completeGoogleOnboarding({ fullName: "Jane", company: " ", onboardingMode: "trial", selectedPlan: "starter" })).rejects.toThrow("google.detailsRequired");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("uses the signed-in session for memberships and Starter for a trial", async () => {
    api.mockImplementation(async (path, options) => {
      expect(await options.getSession()).toBe(session);
      return path === "/api/organizations" ? { data: [] } : { data: { orgId: "new-org" } };
    });
    await completeGoogleOnboarding({ fullName: "Jane", company: "Factory", onboardingMode: "trial", selectedPlan: "business" });
    expect(auth.updateUser).toHaveBeenCalledWith({ data: expect.objectContaining({ selected_plan: "starter" }) });
  });
});
