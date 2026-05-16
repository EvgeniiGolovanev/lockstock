export type PlatformSessionLike = {
  access_token?: string | null;
  user?: {
    email?: string | null;
  } | null;
} | null;

export function platformSessionStatus(session: PlatformSessionLike) {
  if (!session?.access_token) {
    return {
      isAuthenticated: false,
      message: "Sign in with a platform admin account to open the cockpit."
    };
  }

  return {
    isAuthenticated: true,
    message: session.user?.email ? `Signed in as ${session.user.email}` : "Signed in"
  };
}

export function buildPlatformOverviewRequest({ accessToken, query }: { accessToken: string; query: string }) {
  const params = new URLSearchParams();
  const trimmedQuery = query.trim();
  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  return {
    url: `/api/platform/overview${params.size ? `?${params.toString()}` : ""}`,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  };
}

export function buildPlatformMeRequest(accessToken: string) {
  return {
    url: "/api/platform/me",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  };
}

export function platformAccessState({
  authResolved,
  isAuthenticated,
  isPlatformAdmin
}: {
  authResolved: boolean;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean | null;
}) {
  if (!authResolved) {
    return "checking" as const;
  }

  if (!isAuthenticated) {
    return "signed-out" as const;
  }

  if (isPlatformAdmin === true) {
    return "allowed" as const;
  }

  if (isPlatformAdmin === false) {
    return "denied" as const;
  }

  return "checking" as const;
}
