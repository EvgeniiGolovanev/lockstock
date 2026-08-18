import { describe, expect, it } from "vitest";
import { buildPostSignUpPath, buildSignUpPayload, rememberPostSignUpWorkspace } from "@/lib/auth/signup";

describe("signup helpers", () => {
  it("builds paid sign-up payload with payment confirmation redirect", () => {
    const payload = buildSignUpPayload({
      email: "user@example.com",
      password: "password-123",
      fullName: "Alex Doe",
      company: "LockStock Labs",
      selectedPlan: "operations",
      onboardingMode: "paid",
      appOrigin: "https://app.lockstock.io/"
    });

    expect(payload.email).toBe("user@example.com");
    expect(payload.password).toBe("password-123");
    expect(payload.options.data.full_name).toBe("Alex Doe");
    expect(payload.options.data.company).toBe("LockStock Labs");
    expect(payload.options.data.selected_plan).toBe("operations");
    expect(payload.options.data.onboarding_mode).toBe("paid");
    expect(payload.options.emailRedirectTo).toBe("https://app.lockstock.io/payment");
  });

  it("builds trial sign-up payload with account confirmation redirect", () => {
    const payload = buildSignUpPayload({
      email: "user@example.com",
      password: "password-123",
      fullName: "Alex Doe",
      company: "LockStock Labs",
      selectedPlan: "starter",
      onboardingMode: "trial",
      appOrigin: "https://app.lockstock.io/"
    });

    expect(payload.options.data.selected_plan).toBe("starter");
    expect(payload.options.data.onboarding_mode).toBe("trial");
    expect(payload.options.emailRedirectTo).toBe("https://app.lockstock.io/account");
  });

  it.each([
    ["trial", "starter", "/account"],
    ["trial", "operations", "/account"],
    ["trial", "business", "/account"],
    ["trial", "enterprise", "/account"],
    ["paid", "starter", "/payment?onboarding=paid&plan=starter"],
    ["paid", "operations", "/payment?onboarding=paid&plan=operations"],
    ["paid", "business", "/payment?onboarding=paid&plan=business"],
    ["paid", "enterprise", "/payment?onboarding=paid&plan=enterprise"]
  ] as const)("routes %s %s sign-ups to %s", (onboardingMode, selectedPlan, expectedPath) => {
    expect(buildPostSignUpPath({ onboardingMode, selectedPlan })).toBe(expectedPath);
  });

  it("stores the trial workspace for the account page after sign-up", () => {
    const values = new Map<string, string>();
    const storage = {
      setItem: (key: string, value: string) => values.set(key, value)
    };

    rememberPostSignUpWorkspace(storage, "org_123");

    expect(values.get("lockstock.orgId")).toBe("org_123");
  });
});
