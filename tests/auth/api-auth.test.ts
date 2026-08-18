import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { requireAuthenticatedUserId } from "@/lib/api/auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAuthenticatedUserId", () => {
  it("uses the deterministic Playwright identity only when the test server flag is enabled", async () => {
    vi.stubEnv("PLAYWRIGHT_E2E", "true");

    await expect(
      requireAuthenticatedUserId(
        new NextRequest("http://localhost:3000/api/materials", {
          headers: { Authorization: "Bearer fixture-token" }
        })
      )
    ).resolves.toBe("playwright-e2e-user");
  });
});
