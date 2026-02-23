import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { extractBearerToken, requireAuthenticatedUserId } from "@/lib/api/auth";

vi.mock("@/lib/api/auth", () => ({
  extractBearerToken: vi.fn(),
  requireAuthenticatedUserId: vi.fn()
}));

describe("API middleware auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    vi.mocked(extractBearerToken).mockReturnValue(null);

    const request = new NextRequest("http://localhost:3000/api/materials");
    const response = await middleware(request);
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

    const response = await middleware(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("Invalid or expired");
  });
});
