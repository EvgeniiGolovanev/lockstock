"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { LandingHeader } from "@/components/landing-header";
import { message, type StaticMessageKey } from "@/lib/i18n";
import { finishGoogleSignIn, loadGoogleOnboarding, completeGoogleOnboarding, type GoogleOnboarding } from "@/lib/auth/google";
import shell from "./marketing-shell.module.css";
import styles from "./password-recovery.module.css";

export function GoogleAuth({ mode }: { mode: "callback" | "onboarding" }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const [details, setDetails] = useState<GoogleOnboarding | null>(null);
  const [error, setError] = useState<StaticMessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const loading = useRef<Promise<string | Awaited<ReturnType<typeof loadGoogleOnboarding>>> | null>(null);

  useEffect(() => {
    let active = true;
    if (!loading.current) {
      loading.current = mode === "callback"
        ? finishGoogleSignIn(window.location.href).finally(() => window.history.replaceState(null, "", "/auth/callback"))
        : loadGoogleOnboarding();
    }
    void loading.current.then(result => {
      if (!active) return;
      if (typeof result === "string") router.replace(result as Route);
      else if (result.redirectTo) router.replace(result.redirectTo as Route);
      else setDetails(result);
    }).catch(reason => {
      if (active) setError(reason instanceof Error && reason.message === "google.cancelled" ? "google.cancelled" : "google.failed");
    });
    return () => { active = false; };
  }, [mode, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!details || submitting.current) return;
    submitting.current = true; setBusy(true); setError(null);
    try { router.replace(await completeGoogleOnboarding(details) as Route); }
    catch { setError("google.completeFailed"); submitting.current = false; setBusy(false); }
  }

  return <div className={shell.scope}>
    <LandingHeader onSignIn={() => router.push("/?signin=1")} onGetStarted={() => router.push("/?signup=1")} />
    <main className={styles.main}>
      <h1>{t(mode === "callback" ? "landing.auth.google" : "google.completeTitle")}</h1>
      {error && <p role="alert" className={styles.error}>{t(error)}</p>}
      {!details && !error && <p role="status">{t("google.checking")}</p>}
      {details && <>
        <p>{t("google.completeIntro")}</p>
        <form className={styles.form} onSubmit={submit}>
          <label className="field">{t("landing.auth.fullName")}<input autoComplete="name" required maxLength={200} value={details.fullName} disabled={busy} onChange={e => setDetails({ ...details, fullName: e.target.value })} /></label>
          <label className="field">{t("landing.auth.companyName")}<input autoComplete="organization" required maxLength={200} value={details.company} disabled={busy} onChange={e => setDetails({ ...details, company: e.target.value })} /></label>
          <label className="field">{t("landing.auth.startWith")}<select value={details.onboardingMode} disabled={busy} onChange={e => setDetails({ ...details, onboardingMode: e.target.value as GoogleOnboarding["onboardingMode"] })}>
            <option value="trial">{t("landing.auth.starterTrial")}</option><option value="paid">{t("landing.auth.paidPlan")}</option>
          </select></label>
          {details.onboardingMode === "paid" && <label className="field">{t("landing.auth.preferredPlan")}<select value={details.selectedPlan} disabled={busy} onChange={e => setDetails({ ...details, selectedPlan: e.target.value as GoogleOnboarding["selectedPlan"] })}>
            <option value="starter">Starter</option><option value="operations">Operations</option><option value="business">Business</option>
          </select></label>}
          <button type="submit" disabled={busy}>{t(busy ? "landing.auth.wait" : "google.complete")}</button>
        </form>
      </>}
      <div className={styles.links}><Link href="/?signin=1">{t("recovery.back")}</Link></div>
    </main>
  </div>;
}
