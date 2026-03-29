import type { Route } from "next";

type SignedOutRedirectInput = {
  pathname: string;
  isAuthenticated: boolean;
  authResolved: boolean;
};

type SignedOutPanelVisibilityInput = {
  isAuthenticated: boolean;
  authResolved: boolean;
};

export function shouldShowSignedOutPanels({
  isAuthenticated,
  authResolved
}: SignedOutPanelVisibilityInput): boolean {
  return authResolved && !isAuthenticated;
}

export function getSignedOutRedirectPath({
  pathname,
  isAuthenticated,
  authResolved
}: SignedOutRedirectInput): Route | null {
  if (!authResolved || isAuthenticated) {
    return null;
  }

  return pathname === "/" ? null : ("/" as Route);
}
