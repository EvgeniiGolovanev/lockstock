import { describe, expect, it } from "vitest";
import { buildSignUpPayload } from "@/lib/auth/signup";

describe("signup helpers", () => {
  it("builds sign-up payload with account confirmation redirect", () => {
    const payload = buildSignUpPayload({
      email: "user@example.com",
      password: "password-123",
      fullName: "Alex Doe",
      company: "LockStock Labs",
      appOrigin: "https://app.lockstock.io/"
    });

    expect(payload.email).toBe("user@example.com");
    expect(payload.password).toBe("password-123");
    expect(payload.options.data.full_name).toBe("Alex Doe");
    expect(payload.options.data.company).toBe("LockStock Labs");
    expect(payload.options.emailRedirectTo).toBe("https://app.lockstock.io/account");
  });
});
