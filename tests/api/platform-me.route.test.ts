import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/platform/me/route";
import { ApiError } from "@/lib/api/errors";
import { requirePlatformAdmin } from "@/lib/api/platform-admin";

vi.mock("@/lib/api/platform-admin", () => ({
  requirePlatformAdmin: vi.fn()
}));

describe("GET /api/platform/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports platform admin access for authorized users", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue({
      userId: "platform-user",
      role: "operator",
      supabase: {}
    } as never);

    const response = await GET(new NextRequest("http://localhost:3000/api/platform/me"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      isPlatformAdmin: true,
      role: "operator"
    });
  });

  it("returns a non-admin result without surfacing a 403 to the app shell", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new ApiError(403, "Platform admin access is required."));

    const response = await GET(new NextRequest("http://localhost:3000/api/platform/me"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      isPlatformAdmin: false,
      role: null
    });
  });

  it("still rejects invalid sessions", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(new ApiError(401, "Invalid or expired access token."));

    const response = await GET(new NextRequest("http://localhost:3000/api/platform/me"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Invalid or expired access token.");
  });
});
