"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { annualSavings, billingCatalog, type BillingInterval, type PaidPlan } from "@/lib/billing/catalog";

const planCopy: Record<PaidPlan, { title: string; description: string; highlights: string[] }> = {
  starter: { title: "Starter", description: "A controlled first step away from spreadsheets.", highlights: ["3 users", "3 locations", "500 materials"] },
  operations: { title: "Operations", description: "For teams running stock and purchasing every day.", highlights: ["8 users", "Unlimited locations", "Audit export"] },
  business: { title: "Business", description: "For multi-site operations with deeper controls.", highlights: ["20 users", "3 workspaces", "7-year retention"] }
};

type BillingSummary = {
  plan: string;
  status: string;
  billing_interval: string;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  scheduled_plan: string | null;
  scheduled_interval: string | null;
  scheduled_effective_at: string | null;
};

export function LockstockPayment() {
  const [session, setSession] = useState<Session | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("interval") === "annual") setInterval("annual");
    if (params.get("checkout") === "success") setMessage("Payment received. We are confirming your subscription now.");
    if (params.get("checkout") === "cancelled") setMessage("Checkout was cancelled. Your previous access is unchanged.");
    let authTimeout = 0;
    let unsubscribe = () => {};
    try {
      const supabase = getSupabaseBrowserClient();
      authTimeout = window.setTimeout(() => setAuthResolved(true), 2000);
      void supabase.auth.getSession().then(({ data }) => {
        window.clearTimeout(authTimeout);
        setSession(data.session);
        setEmail(data.session?.user.email ?? "");
        setAuthResolved(true);
      }).catch(() => setAuthResolved(true));
      const listener = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
        setEmail(nextSession?.user.email ?? "");
        setAuthResolved(true);
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
    } catch {
      setAuthResolved(true);
    }
    return () => {
      window.clearTimeout(authTimeout);
      unsubscribe();
    };
  }, []);

  const orgId = typeof window === "undefined" ? "" : window.localStorage.getItem("lockstock.orgId") ?? "";
  const headers = useMemo(() => session?.access_token ? {
    Authorization: `Bearer ${session.access_token}`,
    ...(orgId ? { "x-org-id": orgId } : {})
  } : null, [orgId, session?.access_token]);

  useEffect(() => {
    if (!headers || !orgId) return;
    void fetch("/api/billing/summary", { headers }).then(async (response) => {
      if (response.ok) setSummary(((await response.json()) as { data: BillingSummary }).data);
    });
  }, [headers, orgId]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy("signin"); setMessage("");
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Signed in. Choose your plan to continue.");
    setBusy("");
  }

  async function startTrial() {
    if (!headers) return;
    setBusy("trial"); setMessage("");
    const response = await fetch("/api/billing/start-trial", { method: "POST", headers });
    const payload = await response.json();
    if (!response.ok) setMessage(payload.error ?? "Failed to start trial.");
    else {
      window.localStorage.setItem("lockstock.orgId", payload.data.orgId);
      window.location.assign("/inventory");
    }
    setBusy("");
  }

  async function choosePlan(plan: PaidPlan) {
    if (!headers) return;
    setBusy(plan); setMessage("");
    const existingSubscription = Boolean(summary?.stripe_subscription_id);
    const endpoint = existingSubscription ? "/api/billing/change-preview" : "/api/billing/checkout-session";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ plan, interval })
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Billing request failed.");
      setBusy("");
      return;
    }
    if (!existingSubscription) {
      window.localStorage.setItem("lockstock.orgId", payload.data.orgId);
      window.location.assign(payload.data.url);
      return;
    }
    const preview = payload.data;
    const amount = new Intl.NumberFormat("en", { style: "currency", currency: preview.currency ?? "EUR" }).format((preview.amountDue ?? 0) / 100);
    if (!window.confirm(preview.transition.mode === "scheduled" ? `Schedule this change for ${new Date(preview.effectiveAt).toLocaleDateString()}?` : `Confirm the prorated charge of ${amount}?`)) {
      setBusy(""); return;
    }
    const changeResponse = await fetch("/api/billing/change", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ plan, interval, prorationDate: preview.prorationDate })
    });
    const changePayload = await changeResponse.json();
    if (!changeResponse.ok) setMessage(changePayload.error ?? "Plan change failed.");
    else if (changePayload.data.paymentUrl) window.location.assign(changePayload.data.paymentUrl);
    else setMessage(`Plan change ${changePayload.data.mode === "scheduled" ? "scheduled" : "submitted"}.`);
    setBusy("");
  }

  return (
    <main className="payment-page">
      <header className="payment-header">
        <Link className="payment-brand" href="/"><span aria-hidden="true" />LockStock</Link>
        <Link className="ghost-btn" href="/account">Account</Link>
      </header>
      <section className="payment-hero">
        <p>Choose the operating envelope</p>
        <h1>Pay for the capacity you need.<br />Keep control of every movement.</h1>
        <div className="payment-period" aria-label="Billing period">
          <button className={interval === "monthly" ? "active" : ""} onClick={() => setInterval("monthly")}>Monthly</button>
          <button className={interval === "annual" ? "active" : ""} onClick={() => setInterval("annual")}>Annual · save up to 20%</button>
        </div>
      </section>

      {!authResolved ? <p className="payment-message">Checking your account…</p> : null}
      {authResolved && !session ? (
        <section className="payment-auth-gate">
          <div><p>Email confirmation required</p><h2>Confirm your email, then sign in to continue securely.</h2></div>
          <form onSubmit={signIn}>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" required />
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required />
            <button disabled={busy === "signin"}>Sign in</button>
          </form>
        </section>
      ) : null}

      <section className="payment-grid" aria-label="Paid plans">
        {(Object.keys(planCopy) as PaidPlan[]).map((plan) => {
          const tariff = billingCatalog[plan];
          const annual = annualSavings(plan);
          return (
            <article className={`payment-plan ${plan === "operations" ? "featured" : ""}`} key={plan}>
              <p>{plan === "operations" ? "Most operational" : "LockStock plan"}</p>
              <h2>{planCopy[plan].title}</h2>
              <p className="payment-plan-description">{planCopy[plan].description}</p>
              <strong className="payment-price">€{interval === "monthly" ? tariff.monthly : tariff.annual}</strong>
              <span>{interval === "monthly" ? "per month, excl. VAT" : `per year · €${tariff.annualMonthlyEquivalent}/mo · save €${annual.amount}`}</span>
              <ul>{planCopy[plan].highlights.map((item) => <li key={item}>{item}</li>)}</ul>
              <button disabled={!session || Boolean(busy)} onClick={() => void choosePlan(plan)}>
                {busy === plan ? "Preparing…" : summary?.stripe_subscription_id ? "Change to this plan" : "Continue to secure checkout"}
              </button>
            </article>
          );
        })}
      </section>

      <section className="payment-alternatives">
        <article><p>Not ready to subscribe?</p><h2>15-day Starter trial</h2><span>No card required. Starter functionality, then read-only unless you subscribe.</span><button disabled={!session || Boolean(busy)} onClick={() => void startTrial()}>{busy === "trial" ? "Starting…" : "Start free trial"}</button></article>
        <article><p>Complex organization?</p><h2>Enterprise</h2><span>Custom users, retention, security review, and service levels.</span><Link className="ghost-btn" href="/contact">Contact sales</Link></article>
      </section>
      {summary ? <p className="payment-current">Current: {summary.plan} · {summary.billing_interval} · {summary.status}{summary.scheduled_plan ? ` · ${summary.scheduled_plan} scheduled` : ""}</p> : null}
      {message ? <p className="payment-message" role="status">{message}</p> : null}
    </main>
  );
}
