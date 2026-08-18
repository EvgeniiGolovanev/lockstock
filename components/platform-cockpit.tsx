"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { useLanguage } from "@/components/language-provider";
import styles from "./platform-cockpit.module.css";
import { message, type StaticMessageKey } from "@/lib/i18n";
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

function formatInteger(value: number, locale: "en" | "fr") {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB").format(value);
}

function formatDateTime(value: string | null, locale: "en" | "fr") {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
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

function MetricTile({ label, value, detail, locale }: { label: string; value: number; detail: string; locale: "en" | "fr" }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{formatInteger(value, locale)}</strong>
      <small>{detail}</small>
    </div>
  );
}

function statusClassName(status: string) {
  const statusClass = {
    active: styles.statusActive,
    trialing: styles.statusTrialing,
    past_due: styles.statusPastDue,
    unpaid: styles.statusUnpaid,
    incomplete: styles.statusIncomplete,
    cancelled: styles.statusCancelled
  }[status];

  return statusClass ? `${styles.statusPill} ${statusClass}` : styles.statusPill;
}

export function PlatformCockpit() {
  const router = useRouter();
  const { locale } = useLanguage();
  const t = useCallback((key: StaticMessageKey) => message(locale, key), [locale]);
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
          setError(sessionError instanceof Error ? sessionError.message : t("platform.sessionLoadFailed"));
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
      setError(sessionError instanceof Error ? sessionError.message : t("platform.authUnavailable"));
      setAuthResolved(true);
    }

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, [t]);

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
          setError(accessError instanceof Error ? accessError.message : t("platform.accessValidationFailed"));
        }
      }
    }

    void loadPlatformAccess();

    return () => {
      unmounted = true;
    };
  }, [authResolved, session?.access_token, t]);

  const loadOverview = useCallback(async () => {
    const status = platformSessionStatus(session);
    if (!status.isAuthenticated || !session?.access_token) {
      setError(t("platform.signedOutPrompt"));
      return;
    }
    if (isPlatformAdmin !== true) {
      setError(t("platform.adminRequired"));
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
      setError(loadError instanceof Error ? loadError.message : t("platform.overviewLoadFailed"));
      setOverview(null);
    } finally {
      setBusy(false);
    }
  }, [isPlatformAdmin, query, session, t]);

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
      setError(updateError instanceof Error ? updateError.message : t("platform.trialUpdateFailed"));
    } finally {
      setBusy(false);
    }
  }, [loadOverview, session?.access_token, t, trialDrafts]);

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
      setError(signOutError instanceof Error ? signOutError.message : t("platform.signOutFailed"));
    } finally {
      setBusy(false);
    }
  }, [t]);

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
  const sessionMessage = !sessionStatus.isAuthenticated
    ? t("platform.signedOutPrompt")
    : session?.user?.email
      ? message(locale, "platform.signedInAs", { email: session.user.email })
      : t("platform.signedIn");
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
    <main className={styles.shell}>
      <header className={`${styles.content} ${styles.header}`}>
        <div>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark} aria-hidden="true" />
            LockStock
          </Link>
          <h1>{t("platform.title")}</h1>
        </div>
        <div className={styles.sessionPanel}>
          <div>
            <span>{t("platform.session")}</span>
            <strong>{authResolved ? sessionMessage : t("platform.checking")}</strong>
          </div>
          {!sessionStatus.isAuthenticated && authResolved ? (
            <Link className={styles.sessionLink} href="/inventory">
              {t("platform.signIn")}
            </Link>
          ) : null}
          {sessionStatus.isAuthenticated ? (
            <button type="button" className={styles.sessionLink} disabled={busy} onClick={() => void handleSignOut()}>
              {t("platform.signOut")}
            </button>
          ) : null}
          <button type="button" className={styles.iconButton} disabled={busy} onClick={() => void loadOverview()} title={t("platform.refresh")}>
            <RefreshIcon />
          </button>
        </div>
      </header>

      <section className={`${styles.content} ${styles.commandStrip}`}>
        <div>
          <p>{t("platform.internalOperations")}</p>
          <strong>{t("platform.crossTenant")}</strong>
        </div>
        <form
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault();
            void loadOverview();
          }}
        >
          <SearchIcon />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("platform.search")} />
          <button type="submit" disabled={busy}>
            {t("platform.searchAction")}
          </button>
        </form>
      </section>

      {error ? <div className={styles.error}>{error}</div> : null}

      <section className={`${styles.content} ${styles.metricsGrid}`} aria-label={t("platform.metrics")}>
        <MetricTile label={t("platform.tenants")} value={overview?.metrics.totalOrganizations ?? 0} detail={planMix || t("platform.noPlanData")} locale={locale} />
        <MetricTile label={t("platform.registeredUsers")} value={overview?.metrics.registeredUsers ?? 0} detail={`${formatInteger(overview?.metrics.tenantUsers ?? 0, locale)} ${t("platform.tenantMemberships")}`} locale={locale} />
        <MetricTile label={t("platform.stockMovements")} value={overview?.metrics.totalStockMovements ?? 0} detail={`${formatInteger(overview?.metrics.totalMaterials ?? 0, locale)} ${t("platform.materialsTracked")}`} locale={locale} />
        <MetricTile label={t("platform.openPos")} value={overview?.metrics.openPurchaseOrders ?? 0} detail={`${formatInteger(overview?.metrics.totalPurchaseOrders ?? 0, locale)} ${t("platform.totalPurchaseOrders")}`} locale={locale} />
      </section>

      <section className={`${styles.content} ${styles.grid}`}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p>{t("platform.tenants")}</p>
              <h2>{t("platform.footprint")}</h2>
            </div>
            <span>{message(locale, "platform.shown", { count: formatInteger(overview?.tenants.length ?? 0, locale) })}</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("platform.tenant")}</th>
                  <th>{t("platform.plan")}</th>
                  <th>{t("platform.status")}</th>
                  <th>{t("platform.users")}</th>
                  <th>{t("platform.materials")}</th>
                  <th>{t("platform.locations")}</th>
                  <th>{t("platform.movements")}</th>
                  <th>{t("platform.openPos")}</th>
                  <th>{t("platform.lastActivity")}</th>
                  {platformRole === "admin" ? <th>{t("platform.trialControl")}</th> : null}
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
                      <span className={styles.planPill}>{titleCase(tenant.plan)}</span>
                      <small>{titleCase(tenant.billingInterval)}</small>
                    </td>
                    <td>
                      <span className={statusClassName(tenant.billingStatus)}>{titleCase(tenant.billingStatus)}</span>
                      <small>{tenant.currentPeriodEnd ? message(locale, "platform.periodEnds", { date: tenant.currentPeriodEnd }) : tenant.trialEndsAt ? message(locale, "platform.trialEnds", { date: formatDateTime(tenant.trialEndsAt, locale) }) : "-"}</small>
                    </td>
                    <td>{formatInteger(tenant.users, locale)}</td>
                    <td>{formatInteger(tenant.materials, locale)}</td>
                    <td>{formatInteger(tenant.locations, locale)}</td>
                    <td>{formatInteger(tenant.stockMovements, locale)}</td>
                    <td>{formatInteger(tenant.openPurchaseOrders, locale)}</td>
                    <td>{formatDateTime(tenant.lastActivityAt, locale)}</td>
                    {platformRole === "admin" ? (
                      <td>
                        <input
                          type="datetime-local"
                          value={trialDrafts[tenant.id] ?? ""}
                          onChange={(event) => setTrialDrafts((current) => ({ ...current, [tenant.id]: event.target.value }))}
                          aria-label={message(locale, "platform.trialEndAria", { name: tenant.name })}
                        />
                        <button type="button" disabled={busy || !trialDrafts[tenant.id]} onClick={() => void updateTrialEnd(tenant.id)}>
                          {t("platform.save")}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
                {overview && overview.tenants.length === 0 ? (
                  <tr>
                    <td colSpan={platformRole === "admin" ? 10 : 9}>{t("platform.noTenants")}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <aside className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p>{t("platform.audit")}</p>
              <h2>{t("platform.recentActivity")}</h2>
            </div>
          </div>
          <div className={styles.auditList}>
            {(overview?.recentAudit ?? []).map((entry) => (
              <article key={entry.id} className={styles.auditItem}>
                <div>
                  <span>{entry.organizationName}</span>
                  <time>{formatDateTime(entry.created_at, locale)}</time>
                </div>
                <strong>{entry.message}</strong>
                <p>
                  {titleCase(entry.action)} {titleCase(entry.entity_type)}
                  {entry.entity_label ? ` | ${entry.entity_label}` : ""}
                </p>
              </article>
            ))}
            {overview && overview.recentAudit.length === 0 ? <p className={styles.empty}>{t("platform.noAudit")}</p> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
