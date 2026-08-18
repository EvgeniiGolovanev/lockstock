"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { browserApiRequest } from "@/lib/api/browser-request";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { annualSavings, billingCatalog, type BillingInterval, type PaidPlan } from "@/lib/billing/catalog";
import { useLanguage } from "@/components/language-provider";
import { message as renderMessage, type StaticMessageKey } from "@/lib/i18n";
import styles from "./lockstock-payment.module.css";

const PAYMENT_PLAN_MESSAGES: Record<PaidPlan, { title: StaticMessageKey; description: StaticMessageKey; highlights: readonly StaticMessageKey[] }> = {
  starter: { title: "payment.plan.starter.title", description: "payment.plan.starter.description", highlights: ["payment.plan.starter.highlightOne", "payment.plan.starter.highlightTwo", "payment.plan.starter.highlightThree", "payment.plan.starter.highlightFour"] },
  operations: { title: "payment.plan.operations.title", description: "payment.plan.operations.description", highlights: ["payment.plan.operations.highlightOne", "payment.plan.operations.highlightTwo", "payment.plan.operations.highlightThree", "payment.plan.operations.highlightFour"] },
  business: { title: "payment.plan.business.title", description: "payment.plan.business.description", highlights: ["payment.plan.business.highlightOne", "payment.plan.business.highlightTwo", "payment.plan.business.highlightThree", "payment.plan.business.highlightFour"] }
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
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => renderMessage(locale, key);
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
    if (params.get("checkout") === "success") setMessage(renderMessage(locale, "payment.paymentReceived"));
    if (params.get("checkout") === "cancelled") setMessage(renderMessage(locale, "payment.checkoutCancelled"));
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
  }, [locale]);

  const orgId = typeof window === "undefined" ? "" : window.localStorage.getItem("lockstock.orgId") ?? "";

  useEffect(() => {
    if (!orgId) return;
    void browserApiRequest<{ data: BillingSummary }>("/api/billing/summary", { orgId })
      .then((response) => {
        setSummary(response.data);
      })
      .catch(() => {
        setSummary(null);
      });
  }, [orgId]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setBusy("signin"); setMessage("");
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : t("payment.signInSuccess"));
    setBusy("");
  }

  async function startTrial() {
    if (!orgId) return;
    setBusy("trial"); setMessage("");
    try {
      const payload = await browserApiRequest<{ data: { orgId: string } }>("/api/billing/start-trial", { method: "POST", orgId });
      window.localStorage.setItem("lockstock.orgId", payload.data.orgId);
      window.location.assign("/inventory");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("payment.startTrialFailed"));
    } finally {
      setBusy("");
    }
  }

  async function choosePlan(plan: PaidPlan) {
    if (!orgId) return;
    setBusy(plan); setMessage("");
    try {
      const existingSubscription = Boolean(summary?.stripe_subscription_id);
      const endpoint = existingSubscription ? "/api/billing/change-preview" : "/api/billing/checkout-session";
      const payload = await browserApiRequest<{ data: { orgId?: string; url?: string; amountDue?: number; currency?: string; effectiveAt?: string; prorationDate?: string; transition?: { mode: "scheduled" | "immediate" } } }>(endpoint, {
        method: "POST",
        orgId,
        body: { plan, interval }
      });
      if (!existingSubscription) {
        if (payload.data.orgId) {
          window.localStorage.setItem("lockstock.orgId", payload.data.orgId);
        }
        if (payload.data.url) {
          window.location.assign(payload.data.url);
        }
        return;
      }
      const preview = payload.data;
      const amount = new Intl.NumberFormat(locale, { style: "currency", currency: preview.currency ?? "EUR" }).format((preview.amountDue ?? 0) / 100);
      const date = preview.effectiveAt ? new Date(preview.effectiveAt).toLocaleDateString(locale) : t("payment.selectedDate");
      if (!window.confirm(preview.transition?.mode === "scheduled" ? renderMessage(locale, "payment.scheduleChange", { date }) : renderMessage(locale, "payment.proratedCharge", { amount }))) {
        return;
      }
      const changePayload = await browserApiRequest<{ data: { paymentUrl?: string; mode: "scheduled" | "submitted" } }>("/api/billing/change", {
        method: "POST",
        orgId,
        body: { plan, interval, prorationDate: preview.prorationDate }
      });
      if (changePayload.data.paymentUrl) window.location.assign(changePayload.data.paymentUrl);
      else setMessage(t(changePayload.data.mode === "scheduled" ? "payment.changeScheduled" : "payment.changeSubmitted"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("payment.billingFailed"));
    } finally {
      setBusy("");
    }
  }

  return (
    <main className={styles.page} data-i18n-rendered="true">
      <header className={styles.header}>
        <Link className={styles.brand} href="/"><span aria-hidden="true" />LockStock</Link>
        <Link className="ghost-btn" href="/account">{t("payment.account")}</Link>
      </header>
      <section className={styles.hero}>
        <p>{t("payment.eyebrow")}</p>
        <h1>{t("payment.titleFirst")}<br />{t("payment.titleSecond")}</h1>
        <div className={styles.period} aria-label={t("payment.billingPeriod")}>
          <button className={interval === "monthly" ? styles.active : ""} onClick={() => setInterval("monthly")}>{t("payment.monthly")}</button>
          <button className={interval === "annual" ? styles.active : ""} onClick={() => setInterval("annual")}>{t("payment.annual")}</button>
        </div>
      </section>

      {!authResolved ? <p className={styles.message}>{t("payment.checking")}</p> : null}
      {authResolved && !session ? (
        <section className={styles.authGate}>
          <div><p>{t("payment.emailConfirmation")}</p><h2>{t("payment.signInPrompt")}</h2></div>
          <form onSubmit={signIn}>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("payment.email")} required />
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t("payment.password")} required />
            <button disabled={busy === "signin"}>{t("payment.signIn")}</button>
          </form>
        </section>
      ) : null}

      <section className={styles.grid} aria-label={t("payment.paidPlans")}>
        {(Object.keys(PAYMENT_PLAN_MESSAGES) as PaidPlan[]).map((billingPlan) => {
          const plan = PAYMENT_PLAN_MESSAGES[billingPlan];
          const tariff = billingCatalog[billingPlan];
          const annual = annualSavings(billingPlan);
          return (
            <article className={`${styles.plan} ${billingPlan === "operations" ? styles.featured : ""}`} key={billingPlan}>
              <p>{t(billingPlan === "operations" ? "payment.mostOperational" : "payment.lockstockPlan")}</p>
              <h2>{t(plan.title)}</h2>
              <p className={styles.planDescription}>{t(plan.description)}</p>
              <strong className={styles.price}>€{interval === "monthly" ? tariff.monthly : tariff.annual}</strong>
              <span>{interval === "monthly" ? t("payment.monthlyPrice") : renderMessage(locale, "payment.annualPrice", { monthlyEquivalent: String(tariff.annualMonthlyEquivalent), savings: String(annual.amount) })}</span>
              <ul>{plan.highlights.map((item) => <li key={item}>{t(item)}</li>)}</ul>
              <button disabled={!session || Boolean(busy)} onClick={() => void choosePlan(billingPlan)}>
                {busy === billingPlan ? t("payment.preparing") : summary?.stripe_subscription_id ? t("payment.changePlan") : t("payment.checkout")}
              </button>
            </article>
          );
        })}
      </section>

      <section className={styles.alternatives}>
        <article><p>{t("payment.notReady")}</p><h2>{t("payment.trialTitle")}</h2><span>{t("payment.trialDescription")}</span><button disabled={!session || Boolean(busy)} onClick={() => void startTrial()}>{busy === "trial" ? t("payment.starting") : t("payment.startTrial")}</button></article>
        <article><p>{t("payment.complexOrg")}</p><h2>{t("payment.enterprise")}</h2><span>{t("payment.enterpriseDescription")}</span><Link className="ghost-btn" href="/contact">{t("payment.contactSales")}</Link></article>
      </section>
      {summary ? <p className={styles.current}>{renderMessage(locale, "payment.current", { plan: summary.plan, interval: summary.billing_interval, status: summary.status })}{summary.scheduled_plan ? renderMessage(locale, "payment.currentScheduled", { plan: summary.scheduled_plan }) : ""}</p> : null}
      {message ? <p className={styles.message} role="status">{message}</p> : null}
    </main>
  );
}
