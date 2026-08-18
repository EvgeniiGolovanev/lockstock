import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(),
  requireAuthenticatedUserId: vi.fn()
}));

describe("API middleware auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when Authorization header is missing", async () => {
    vi.mocked(extractBearerToken).mockReturnValue(null);

    const request = new NextRequest("http://localhost:3000/api/materials");
    const response = await proxy(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Missing Authorization");
  });

  it("returns 401 when token is invalid", async () => {
    vi.mocked(extractBearerToken).mockReturnValue("bad-token");
    vi.mocked(requireAuthenticatedUserId).mockRejectedValue(new Error("invalid"));

    const request = new NextRequest("http://localhost:3000/api/materials", {
      headers: { Authorization: "Bearer bad-token" }
    });

    const response = await proxy(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Invalid or expired");
  });

  it("allows public contact messages without an Authorization header", async () => {
    const request = new NextRequest("http://localhost:3000/api/contact", {
      method: "POST"
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(extractBearerToken).not.toHaveBeenCalled();
    expect(requireAuthenticatedUserId).not.toHaveBeenCalled();
  });

  it("allows Playwright fixture requests without reaching a real Supabase Auth server", async () => {
    vi.stubEnv("PLAYWRIGHT_E2E", "true");

    const request = new NextRequest("http://localhost:3000/api/materials", {
      headers: { Authorization: "Bearer fixture-token" }
    });
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(requireAuthenticatedUserId).not.toHaveBeenCalled();
  });
});
