"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { buildAccountMetadata, metadataValue, validatePasswordChange } from "@/lib/auth/account";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ActivityEntry = {
  id: string;
  line: string;
};

type NavHref = "/inventory" | "/materials" | "/locations" | "/vendors" | "/purchase-orders";

const NAV_ITEMS: Array<{ href: NavHref; label: string }> = [
  { href: "/inventory", label: "Inventory" },
  { href: "/materials", label: "Materials & Stock" },
  { href: "/locations", label: "Locations" },
  { href: "/vendors", label: "Vendors" },
  { href: "/purchase-orders", label: "Purchase Orders" }
];

export function LockstockAccount() {
  const pathname = usePathname();
  const router = useRouter();

  const [signedInAs, setSignedInAs] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountFullName, setAccountFullName] = useState("");
  const [accountCompany, setAccountCompany] = useState("");
  const [accountPhone, setAccountPhone] = useState("");
  const [accountJobTitle, setAccountJobTitle] = useState("");
  const [accountNewPassword, setAccountNewPassword] = useState("");
  const [accountConfirmPassword, setAccountConfirmPassword] = useState("");
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [busy, setBusy] = useState(false);

  function addActivity(message: string) {
    const stamp = new Date().toLocaleTimeString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setActivity((prev) => [{ id, line: `${stamp} - ${message}` }, ...prev].slice(0, 10));
  }

  function applySessionState(session: { user: { email?: string | null; user_metadata?: Record<string, unknown> } }) {
    setSignedInAs(session.user.email ?? "");
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
      void supabase.auth.getSession().then(({ data, error }) => {
        if (unmounted || error) {
          return;
        }

        if (!data.session) {
          setSignedInAs("");
          return;
        }

        applySessionState({
          user: {
            email: data.session.user.email,
            user_metadata: data.session.user.user_metadata as Record<string, unknown>
          }
        });
      });

      const authListener = supabase.auth.onAuthStateChange((event, session) => {
        if (unmounted) {
          return;
        }

        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") && session) {
          applySessionState({
            user: {
              email: session.user.email,
              user_metadata: session.user.user_metadata as Record<string, unknown>
            }
          });
        }

        if (event === "SIGNED_OUT") {
          setSignedInAs("");
          setAccountEmail("");
          setAccountFullName("");
          setAccountCompany("");
          setAccountPhone("");
          setAccountJobTitle("");
          setAccountNewPassword("");
          setAccountConfirmPassword("");
        }
      });

      unsubscribe = () => authListener.data.subscription.unsubscribe();
    } catch {
      addActivity("Supabase browser auth is not configured.");
    }

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

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

  return (
    <>
      <section className="card shell-nav">
        <div className="shell-top">
          <div className="brand-wrap">
            <div className="brand-mark">LS</div>
            <div>
              <h2>LockStock</h2>
            </div>
          </div>
          <div className="nav-links">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`nav-link ${active ? "nav-link-active" : ""}`}>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="shell-user-actions">
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

      <section className="card">
        <h3>Activity</h3>
        {activity.length === 0 ? <p>No activity yet.</p> : null}
        {activity.map((item) => (
          <p key={item.id} className="mono-line">
            {item.line}
          </p>
        ))}
      </section>
    </>
  );
}
