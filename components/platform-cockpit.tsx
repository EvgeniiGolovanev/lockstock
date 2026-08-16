"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { browserApiRequest } from "@/lib/api/browser-request";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { platformAccessState, platformSessionStatus } from "@/lib/ui/platform-cockpit";

type PlatformMetrics = {
  totalOrganizations: number;
  registeredUsers: number;
  tenantUsers: number;
  totalMaterials: number;
  totalLocations: number;
  totalStockMovements: number;
  totalPurchaseOrders: number;
  openPurchaseOrders: number;
};

type PlatformTenant = {
  id: string;
  name: string;
  createdAt: string;
  plan: string;
  billingStatus: string;
  billingInterval: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  users: number;
  materials: number;
  locations: number;
  stockMovements: number;
  purchaseOrders: number;
  openPurchaseOrders: number;
  lastActivityAt: string | null;
};

type PlatformAudit = {
  id: string;
  organizationName: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_label: string | null;
  message: string;
  created_at: string;
};

type PlatformOverview = {
  metrics: PlatformMetrics;
  tenants: PlatformTenant[];
  recentAudit: PlatformAudit[];
};

function formatInteger(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function dateTimeLocalValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.4-4.4M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6v5h-5M4 18v-5h5M18.1 9a7 7 0 0 0-11.8-2.4L4 9m16 6-2.3 2.4A7 7 0 0 1 5.9 15" />
    </svg>
  );
}

function MetricTile({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="platform-metric">
      <span>{label}</span>
      <strong>{formatInteger(value)}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function PlatformCockpit() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [platformRole, setPlatformRole] = useState<"support" | "operator" | "admin" | null>(null);
  const [query, setQuery] = useState("");
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [trialDrafts, setTrialDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    let unmounted = false;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseBrowserClient();

      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (unmounted) {
            return;
          }
          if (error) {
            setError(error.message);
            setSession(null);
          } else {
            setSession(data.session);
          }
          setAuthResolved(true);
        })
        .catch((sessionError) => {
          if (unmounted) {
            return;
          }
          setError(sessionError instanceof Error ? sessionError.message : "Failed to load the current session.");
          setSession(null);
          setAuthResolved(true);
        });

      const authListener = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (unmounted) {
          return;
        }
        setSession(nextSession);
        setAuthResolved(true);
        if (!nextSession) {
          setOverview(null);
          setIsPlatformAdmin(null);
        }
      });

      unsubscribe = () => authListener.data.subscription.unsubscribe();
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Supabase browser auth is not configured.");
      setAuthResolved(true);
    }

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authResolved || !session?.access_token) {
      setIsPlatformAdmin(null);
      return;
    }

    let unmounted = false;

    async function loadPlatformAccess() {
      try {
        const payload = await browserApiRequest<{ isPlatformAdmin?: boolean; role?: "support" | "operator" | "admin" | null }>("/api/platform/me");

        if (!unmounted) {
          setIsPlatformAdmin(payload.isPlatformAdmin === true);
          setPlatformRole(payload.role ?? null);
        }
      } catch (accessError) {
        if (!unmounted) {
          setIsPlatformAdmin(false);
          setError(accessError instanceof Error ? accessError.message : "Failed to validate platform access.");
        }
      }
    }

    void loadPlatformAccess();

    return () => {
      unmounted = true;
    };
  }, [authResolved, session?.access_token]);

  const loadOverview = useCallback(async () => {
    const status = platformSessionStatus(session);
    if (!status.isAuthenticated || !session?.access_token) {
      setError(status.message);
      return;
    }
    if (isPlatformAdmin !== true) {
      setError("Platform admin access is required.");
      setOverview(null);
      return;
    }

    setBusy(true);
    setError("");

    try {
      const params = new URLSearchParams();
      const trimmedQuery = query.trim();
      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      }

      const payload = await browserApiRequest<PlatformOverview>(`/api/platform/overview${params.size ? `?${params.toString()}` : ""}`);

      setOverview(payload);
      setTrialDrafts(
        Object.fromEntries(
          payload.tenants.map((tenant) => [tenant.id, dateTimeLocalValue(tenant.trialEndsAt)])
        )
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load platform overview.");
      setOverview(null);
    } finally {
      setBusy(false);
    }
  }, [isPlatformAdmin, query, session]);

  const updateTrialEnd = useCallback(async (tenantId: string) => {
    const draft = trialDrafts[tenantId];
    if (!session?.access_token || !draft) return;
    setBusy(true);
    setError("");
    try {
      await browserApiRequest(`/api/platform/organizations/${tenantId}/billing`, {
        method: "PATCH",
        body: { trialEndsAt: new Date(draft).toISOString() }
      });
      await loadOverview();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update trial end date.");
    } finally {
      setBusy(false);
    }
  }, [loadOverview, session?.access_token, trialDrafts]);

  useEffect(() => {
    if (authResolved && session?.access_token && isPlatformAdmin === true) {
      void loadOverview();
    }
  }, [authResolved, isPlatformAdmin, loadOverview, session?.access_token]);

  const handleSignOut = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
      setSession(null);
      setIsPlatformAdmin(null);
      setOverview(null);
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Failed to sign out.");
    } finally {
      setBusy(false);
    }
  }, []);

  const planMix = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tenant of overview?.tenants ?? []) {
      counts.set(tenant.plan, (counts.get(tenant.plan) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([plan, count]) => `${titleCase(plan)} ${count}`)
      .join(" | ");
  }, [overview]);

  const sessionStatus = platformSessionStatus(session);
  const accessState = platformAccessState({
    authResolved,
    isAuthenticated: sessionStatus.isAuthenticated,
    isPlatformAdmin
  });

  useEffect(() => {
    if (accessState === "signed-out" || accessState === "denied") {
      router.replace("/inventory");
    }
  }, [accessState, router]);

  if (accessState !== "allowed") {
    return null;
  }

  return (
    <main className="platform-shell">
      <header className="platform-header">
        <div>
          <Link className="platform-brand" href="/">
            <span className="platform-brand-mark" aria-hidden="true" />
            LockStock
          </Link>
          <h1>Platform Cockpit</h1>
        </div>
        <div className="platform-session-panel">
          <div>
            <span>Session</span>
            <strong>{authResolved ? sessionStatus.message : "Checking session..."}</strong>
          </div>
          {!sessionStatus.isAuthenticated && authResolved ? (
            <Link className="platform-session-link" href="/inventory">
              Sign in
            </Link>
          ) : null}
          {sessionStatus.isAuthenticated ? (
            <button type="button" className="platform-session-link" disabled={busy} onClick={() => void handleSignOut()}>
              Sign out
            </button>
          ) : null}
          <button type="button" className="platform-icon-button" disabled={busy} onClick={() => void loadOverview()} title="Refresh cockpit">
            <RefreshIcon />
          </button>
        </div>
      </header>

      <section className="platform-command-strip">
        <div>
          <p>Internal operations</p>
          <strong>Cross-tenant visibility with read-only access logging.</strong>
        </div>
        <form
          className="platform-search"
          onSubmit={(event) => {
            event.preventDefault();
            void loadOverview();
          }}
        >
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tenants by name" />
          <button type="submit" disabled={busy}>
            Search
          </button>
        </form>
      </section>

      {error ? <div className="platform-error">{error}</div> : null}

      <section className="platform-metrics-grid" aria-label="Platform metrics">
        <MetricTile label="Tenants" value={overview?.metrics.totalOrganizations ?? 0} detail={planMix || "No plan data loaded"} />
        <MetricTile label="Registered users" value={overview?.metrics.registeredUsers ?? 0} detail={`${overview?.metrics.tenantUsers ?? 0} tenant memberships`} />
        <MetricTile label="Stock movements" value={overview?.metrics.totalStockMovements ?? 0} detail={`${overview?.metrics.totalMaterials ?? 0} materials tracked`} />
        <MetricTile label="Open POs" value={overview?.metrics.openPurchaseOrders ?? 0} detail={`${overview?.metrics.totalPurchaseOrders ?? 0} total purchase orders`} />
      </section>

      <section className="platform-grid">
        <div className="platform-panel platform-panel-wide">
          <div className="platform-panel-head">
            <div>
              <p>Tenants</p>
              <h2>Plan and operational footprint</h2>
            </div>
            <span>{overview?.tenants.length ?? 0} shown</span>
          </div>

          <div className="platform-table-wrap">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>Materials</th>
                  <th>Locations</th>
                  <th>Movements</th>
                  <th>Open POs</th>
                  <th>Last activity</th>
                  {platformRole === "admin" ? <th>Trial control</th> : null}
                </tr>
              </thead>
              <tbody>
                {(overview?.tenants ?? []).map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <strong>{tenant.name}</strong>
                      <small>{tenant.id}</small>
                    </td>
                    <td>
                      <span className="platform-plan-pill">{titleCase(tenant.plan)}</span>
                      <small>{titleCase(tenant.billingInterval)}</small>
                    </td>
                    <td>
                      <span className={`platform-status-pill platform-status-${tenant.billingStatus}`}>{titleCase(tenant.billingStatus)}</span>
                      <small>{tenant.currentPeriodEnd ? `Period ends ${tenant.currentPeriodEnd}` : tenant.trialEndsAt ? `Trial ends ${formatDateTime(tenant.trialEndsAt)}` : "-"}</small>
                    </td>
                    <td>{formatInteger(tenant.users)}</td>
                    <td>{formatInteger(tenant.materials)}</td>
                    <td>{formatInteger(tenant.locations)}</td>
                    <td>{formatInteger(tenant.stockMovements)}</td>
                    <td>{formatInteger(tenant.openPurchaseOrders)}</td>
                    <td>{formatDateTime(tenant.lastActivityAt)}</td>
                    {platformRole === "admin" ? (
                      <td>
                        <input
                          type="datetime-local"
                          value={trialDrafts[tenant.id] ?? ""}
                          onChange={(event) => setTrialDrafts((current) => ({ ...current, [tenant.id]: event.target.value }))}
                          aria-label={`Trial end for ${tenant.name}`}
                        />
                        <button type="button" disabled={busy || !trialDrafts[tenant.id]} onClick={() => void updateTrialEnd(tenant.id)}>
                          Save
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {overview && overview.tenants.length === 0 ? (
                  <tr>
                    <td colSpan={platformRole === "admin" ? 10 : 9}>No tenants match the current search.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="platform-panel">
          <div className="platform-panel-head">
            <div>
              <p>Audit</p>
              <h2>Recent activity</h2>
            </div>
          </div>
          <div className="platform-audit-list">
            {(overview?.recentAudit ?? []).map((entry) => (
              <article key={entry.id} className="platform-audit-item">
                <div>
                  <span>{entry.organizationName}</span>
                  <time>{formatDateTime(entry.created_at)}</time>
                </div>
                <strong>{entry.message}</strong>
                <p>
                  {titleCase(entry.action)} {titleCase(entry.entity_type)}
                  {entry.entity_label ? ` | ${entry.entity_label}` : ""}
                </p>
              </article>
            ))}
            {overview && overview.recentAudit.length === 0 ? <p className="platform-empty">No recent audit events.</p> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
