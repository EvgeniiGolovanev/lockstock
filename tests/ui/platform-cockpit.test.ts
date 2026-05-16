import { describe, expect, it } from "vitest";
import { buildPlatformMeRequest, buildPlatformOverviewRequest, platformAccessState, platformSessionStatus } from "@/lib/ui/platform-cockpit";

describe("platform cockpit session helpers", () => {
  it("requires a Supabase browser session before loading platform data", () => {
    expect(platformSessionStatus(null)).toEqual({
      isAuthenticated: false,
      message: "Sign in with a platform admin account to open the cockpit."
    });
  });

  it("builds a platform overview request with the current session access token", () => {
    const request = buildPlatformOverviewRequest({
      accessToken: "fresh-token",
      query: " north "
    });

    expect(request).toEqual({
      url: "/api/platform/overview?q=north",
      headers: {
        Authorization: "Bearer fresh-token"
      }
    });
  });

  it("omits the search parameter when tenant search is blank", () => {
    const request = buildPlatformOverviewRequest({
      accessToken: "fresh-token",
      query: "   "
    });

    expect(request.url).toBe("/api/platform/overview");
  });

  it("builds a platform admin discovery request with the current session access token", () => {
    expect(buildPlatformMeRequest("fresh-token")).toEqual({
      url: "/api/platform/me",
      headers: {
        Authorization: "Bearer fresh-token"
      }
    });
  });

  it("keeps the cockpit hidden until platform admin access is confirmed", () => {
    expect(platformAccessState({ authResolved: true, isAuthenticated: true, isPlatformAdmin: null })).toBe("checking");
    expect(platformAccessState({ authResolved: true, isAuthenticated: true, isPlatformAdmin: false })).toBe("denied");
    expect(platformAccessState({ authResolved: true, isAuthenticated: true, isPlatformAdmin: true })).toBe("allowed");
  });
});
