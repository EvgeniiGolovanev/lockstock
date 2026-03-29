import { describe, expect, it } from "vitest";
import { getSignedOutRedirectPath, shouldShowSignedOutPanels } from "@/lib/auth/route-guards";

describe("shouldShowSignedOutPanels", () => {
  it("keeps signed-out auth panels hidden until auth resolution completes", () => {
    expect(
      shouldShowSignedOutPanels({
        isAuthenticated: false,
        authResolved: false
      })
    ).toBe(false);
  });

  it("shows signed-out auth panels only after auth resolution confirms the user is signed out", () => {
    expect(
      shouldShowSignedOutPanels({
        isAuthenticated: false,
        authResolved: true
      })
    ).toBe(true);
  });

  it("keeps signed-out auth panels hidden for authenticated users", () => {
    expect(
      shouldShowSignedOutPanels({
        isAuthenticated: true,
        authResolved: true
      })
    ).toBe(false);
  });
});

describe("getSignedOutRedirectPath", () => {
  it("does not redirect before auth resolution completes", () => {
    expect(
      getSignedOutRedirectPath({
        pathname: "/members",
        isAuthenticated: false,
        authResolved: false
      })
    ).toBeNull();
  });

  it("does not redirect authenticated users", () => {
    expect(
      getSignedOutRedirectPath({
        pathname: "/members",
        isAuthenticated: true,
        authResolved: true
      })
    ).toBeNull();
  });

  it("does not redirect signed-out users already on the landing page", () => {
    expect(
      getSignedOutRedirectPath({
        pathname: "/",
        isAuthenticated: false,
        authResolved: true
      })
    ).toBeNull();
  });

  it("redirects signed-out users away from protected screens", () => {
    expect(
      getSignedOutRedirectPath({
        pathname: "/members",
        isAuthenticated: false,
        authResolved: true
      })
    ).toBe("/");

    expect(
      getSignedOutRedirectPath({
        pathname: "/account",
        isAuthenticated: false,
        authResolved: true
      })
    ).toBe("/");
  });
});
