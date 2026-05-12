"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { NavItemIcon, type NavIcon } from "@/components/nav-item-icon";
import { buildAccountMetadata, metadataValue, validatePasswordChange } from "@/lib/auth/account";
import { getSignedOutRedirectPath } from "@/lib/auth/route-guards";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { summarizeAuditMetadata } from "@/lib/ui/audit-log";
import { useActivityLog } from "@/lib/ui/use-activity-log";

type NavHref = "/inventory" | "/materials" | "/stock-movements" | "/locations" | "/vendors" | "/purchase-orders" | "/members";
type OrgRole = "owner" | "manager" | "member" | "viewer";

type AuditLogEntry = {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_label: string | null;
  message: string;
  metadata: unknown;
  created_at: string;
};

type OrganizationMembership = {
  role: OrgRole;
  organization: {
    id: string;
    name: string;
  };
};

const NAV_ITEMS: Array<{ href: NavHref; label: string; icon: NavIcon }> = [
  { href: "/inventory", label: "Inventory", icon: "inventory" },
  { href: "/materials", label: "Materials", icon: "materials" },
  { href: "/stock-movements", label: "Stock Movements", icon: "stock-movements" },
  { href: "/locations", label: "Locations", icon: "locations" },
  { href: "/vendors", label: "Vendors", icon: "vendors" },
  { href: "/purchase-orders", label: "Purchase Orders", icon: "purchase-orders" },
  { href: "/members", label: "Members", icon: "members" }
];

const STORAGE_KEYS = {
  orgId: "lockstock.orgId"
} as const;

function todayDateInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoDateInputValue(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function canExportAuditLog(role: OrgRole | "") {
  return role === "owner" || role === "manager";
}

export function LockstockAccount() {
  const pathname = usePathname();
  const router = useRouter();

  const [signedInAs, setSignedInAs] = useState("");
  const { addActivity } = useActivityLog(signedInAs);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountFullName, setAccountFullName] = useState("");
  const [accountCompany, setAccountCompany] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountJobTitle, setAccountJobTitle] = useState("");
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountConfirmPassword, setAccountConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [activeOrgId, setActiveOrgId] = useState("");
  const [activeOrgRole, setActiveOrgRole] = useState<OrgRole | "">("");
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditStatus, setAuditStatus] = useState("");
  const [auditExportFrom, setAuditExportFrom] = useState(daysAgoDateInputValue(7));
  const [auditExportTo, setAuditExportTo] = useState(todayDateInputValue());

  function applySessionState(session: {
    access_token?: string;
    user: { email?: string | null; user_metadata?: Record<string, unknown> };
  }) {
    setSignedInAs(session.user.email ?? "");
    setAccessToken(session.access_token ?? "");
    setAccountEmail(session.user.email ?? "");
    setAccountFullName(metadataValue(session.user.user_metadata, "full_name"));
    setAccountCompany(metadataValue(session.user.user_metadata, "company"));
    setAccountPhone(metadataValue(session.user.user_metadata, "phone"));
    setAccountJobTitle(metadataValue(session.user.user_metadata, "job_title"));
  }

  useEffect(() => {
    let unmounted = false;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth
        .getSession()
        .then(({ data, error }) => {
          if (unmounted || error) {
            return;
          }

          if (!data.session) {
            setSignedInAs("");
            setAuthResolved(true);
            return;
          }

          applySessionState({
            access_token: data.session.access_token,
            user: {
              email: data.session.user.email,
              user_metadata: data.session.user.user_metadata as Record<string, unknown>
            }
          });
          setAuthResolved(true);
        })
        .catch(() => {
          if (unmounted) {
            return;
          }
          setSignedInAs("");
          setAuthResolved(true);
        });

      const authListener = supabase.auth.onAuthStateChange((event, session) => {
        if (unmounted) {
          return;
        }

        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) {
          applySessionState({
            access_token: session.access_token,
            user: {
              email: session.user.email,
              user_metadata: session.user.user_metadata as Record<string, unknown>
            }
          });
          setAuthResolved(true);
        }

        if (event === "SIGNED_OUT") {
          setSignedInAs("");
          setAccessToken("");
          setActiveOrgId("");
          setActiveOrgRole("");
          setAuditLog([]);
          setAccountEmail("");
          setAccountFullName("");
          setAccountCompany("");
          setAccountPhone("");
          setAccountJobTitle("");
          setAccountNewPassword("");
          setAccountConfirmPassword("");
          setAuthResolved(true);
        }
      });

      unsubscribe = () => authListener.data.subscription.unsubscribe();
    } catch {
      addActivity("Supabase browser auth is not configured.");
      setAuthResolved(true);
    }

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, [addActivity]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setActiveOrgId(window.localStorage.getItem(STORAGE_KEYS.orgId) ?? "");
  }, [signedInAs]);

  useEffect(() => {
    if (!accessToken || !activeOrgId) {
      setAuditLog([]);
      setActiveOrgRole("");
      setAuditStatus(accessToken ? "Open a group workspace before viewing the audit log." : "");
      return;
    }

    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "x-org-id": activeOrgId
    };

    async function loadAuditContext() {
      try {
        setAuditStatus("Loading audit log...");
        const [auditResponse, organizationsResponse] = await Promise.all([
          fetch("/api/audit-log", { headers }),
          fetch("/api/organizations", {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
        ]);

        if (!auditResponse.ok) {
          const body = await auditResponse.json().catch(() => ({ error: "Failed to load audit log." }));
          throw new Error(body.error ?? "Failed to load audit log.");
        }

        const auditBody = (await auditResponse.json()) as { data: AuditLogEntry[] };
        setAuditLog(auditBody.data ?? []);

        if (organizationsResponse.ok) {
          const organizationsBody = (await organizationsResponse.json()) as { data: OrganizationMembership[] };
          const membership = organizationsBody.data.find((item) => item.organization.id === activeOrgId);
          setActiveOrgRole(membership?.role ?? "");
        }

        setAuditStatus("");
      } catch (error) {
        setAuditStatus((error as Error).message);
      }
    }

    void loadAuditContext();
  }, [accessToken, activeOrgId]);

  useEffect(() => {
    const redirectPath = getSignedOutRedirectPath({
      pathname,
      isAuthenticated: Boolean(signedInAs),
      authResolved
    });

    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [authResolved, pathname, router, signedInAs]);

  async function handleSignOut() {
    try {
      setBusy(true);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      addActivity("Signed out.");
      router.push("/");
    } catch (error) {
      addActivity(`Logout failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdatePrivateInfo() {
    try {
      setBusy(true);
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.updateUser({
        data: buildAccountMetadata({
          fullName: accountFullName,
          company: accountCompany,
          phone: accountPhone,
          jobTitle: accountJobTitle
        })
      });
      if (error) {
        throw error;
      }

      setAccountFullName(metadataValue(data.user.user_metadata, "full_name"));
      setAccountCompany(metadataValue(data.user.user_metadata, "company"));
      setAccountPhone(metadataValue(data.user.user_metadata, "phone"));
      setAccountJobTitle(metadataValue(data.user.user_metadata, "job_title"));
      addActivity("Private profile information updated.");
    } catch (error) {
      addActivity(`Update profile failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateEmail() {
    try {
      const nextEmail = accountEmail.trim().toLowerCase();
      if (!nextEmail) {
        addActivity("Update email failed: enter a valid email.");
        return;
      }

      setBusy(true);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        email: nextEmail
      });
      if (error) {
        throw error;
      }

      setAccountEmail(nextEmail);
      addActivity("Email update requested. Check your inbox to confirm the new address.");
    } catch (error) {
      addActivity(`Update email failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdatePassword() {
    const validationError = validatePasswordChange(accountNewPassword, accountConfirmPassword);
    if (validationError) {
      addActivity(`Update password failed: ${validationError}`);
      return;
    }

    try {
      setBusy(true);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({
        password: accountNewPassword
      });
      if (error) {
        throw error;
      }

      setAccountNewPassword("");
      setAccountConfirmPassword("");
      addActivity("Password updated.");
    } catch (error) {
      addActivity(`Update password failed: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadAuditLog() {
    try {
      if (!accessToken || !activeOrgId) {
        setAuditStatus("Select an active group before exporting the audit log.");
        return;
      }

      setBusy(true);
      setAuditStatus("Preparing audit export...");
      const params = new URLSearchParams({
        format: "csv",
        from: auditExportFrom,
        to: auditExportTo
      });
      const response = await fetch(`/api/audit-log?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "x-org-id": activeOrgId
        }
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: "Audit export failed." }));
        throw new Error(body.error ?? "Audit export failed.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-log-${auditExportFrom}-${auditExportTo}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setAuditStatus("");
    } catch (error) {
      setAuditStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="card shell-nav">
        <div className="shell-top">
          <div className="brand-wrap">
            <svg className="brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
              <rect x="2" y="4" width="60" height="8" />
              <rect className="brand-mark-accent" x="2" y="16" width="60" height="8" />
              <rect x="2" y="28" width="60" height="8" />
            </svg>
            <div>
              <h2>LockStock</h2>
            </div>
          </div>
          <div className="nav-links">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? "nav-link-active" : ""}`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <NavItemIcon icon={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="shell-user-actions">
            <LanguageSwitcher />
            {signedInAs ? (
              <>
                <Link href="/account" className={`nav-link ${pathname === "/account" ? "nav-link-active" : ""}`}>
                  Account
                </Link>
                <button type="button" className="ghost-btn" disabled={busy} onClick={handleSignOut}>
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/" className="nav-link">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="title-row">
          <div>
            <h1>Account</h1>
            <p>Manage your email, password, and private profile details.</p>
          </div>
        </div>
      </section>

      <section className="card">
        {signedInAs ? (
          <div className="grid account-grid">
            <article className="account-card">
              <h3>Private Info</h3>
              <p className="subtle-line">Stored as private profile metadata on your user account.</p>
              <div className="grid grid-2">
                <label className="field">
                  <span>Full Name</span>
                  <input value={accountFullName} onChange={(event) => setAccountFullName(event.target.value)} />
                </label>
                <label className="field">
                  <span>Company</span>
                  <input value={accountCompany} onChange={(event) => setAccountCompany(event.target.value)} />
                </label>
                <label className="field">
                  <span>Phone</span>
                  <input value={accountPhone} onChange={(event) => setAccountPhone(event.target.value)} />
                </label>
                <label className="field">
                  <span>Job Title</span>
                  <input value={accountJobTitle} onChange={(event) => setAccountJobTitle(event.target.value)} />
                </label>
              </div>
              <div className="actions">
                <button type="button" disabled={busy} onClick={handleUpdatePrivateInfo}>
                  Save Private Info
                </button>
              </div>
            </article>

            <article className="account-card">
              <h3>Email</h3>
              <p className="subtle-line">Changing email requires inbox confirmation from Supabase Auth.</p>
              <div className="grid">
                <label className="field">
                  <span>Current Email</span>
                  <input value={signedInAs} readOnly />
                </label>
                <label className="field">
                  <span>New Email</span>
                  <input type="email" value={accountEmail} onChange={(event) => setAccountEmail(event.target.value)} />
                </label>
              </div>
              <div className="actions">
                <button type="button" disabled={busy || !accountEmail.trim()} onClick={handleUpdateEmail}>
                  Update Email
                </button>
              </div>
            </article>

            <article className="account-card">
              <h3>Password</h3>
              <p className="subtle-line">Use a strong password with at least 8 characters.</p>
              <div className="grid grid-2">
                <label className="field">
                  <span>New Password</span>
                  <input
                    type="password"
                    value={accountNewPassword}
                    onChange={(event) => setAccountNewPassword(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Confirm New Password</span>
                  <input
                    type="password"
                    value={accountConfirmPassword}
                    onChange={(event) => setAccountConfirmPassword(event.target.value)}
                  />
                </label>
              </div>
              <div className="actions">
                <button
                  type="button"
                  disabled={busy || !accountNewPassword || !accountConfirmPassword}
                  onClick={handleUpdatePassword}
                >
                  Update Password
                </button>
              </div>
            </article>
          </div>
        ) : (
          <p>Sign in to manage your account details.</p>
        )}
      </section>

      <section className="card audit-card">
        <div className="title-row">
          <div>
            <h3>Activity Log</h3>
            <p>Latest 20 recorded changes for the active group.</p>
          </div>
        </div>

        {canExportAuditLog(activeOrgRole) ? (
          <div className="audit-export-row">
            <label className="field">
              <span>From</span>
              <input type="date" value={auditExportFrom} onChange={(event) => setAuditExportFrom(event.target.value)} />
            </label>
            <label className="field">
              <span>To</span>
              <input type="date" value={auditExportTo} onChange={(event) => setAuditExportTo(event.target.value)} />
            </label>
            <button type="button" disabled={busy || !auditExportFrom || !auditExportTo} onClick={handleDownloadAuditLog}>
              Download CSV
            </button>
          </div>
        ) : null}

        {auditStatus ? <p className="subtle-line">{auditStatus}</p> : null}
        {!auditStatus && auditLog.length === 0 ? <p>No recorded changes yet.</p> : null}
        <div className="audit-log-list">
          {auditLog.map((item) => (
            <article key={item.id} className="audit-log-row">
              <time>{formatAuditDate(item.created_at)}</time>
              <div>
                <p>{item.message}</p>
                {summarizeAuditMetadata(item.metadata).map((detail) => (
                  <small key={detail}>{detail}</small>
                ))}
              </div>
              <span>
                {item.entity_type.replaceAll("_", " ")}
                {item.entity_label ? ` - ${item.entity_label}` : ""}
              </span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
