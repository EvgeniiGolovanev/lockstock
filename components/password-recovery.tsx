"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { LandingHeader } from "@/components/landing-header";
import { message, type StaticMessageKey } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { openRecoverySession } from "@/lib/auth/password-recovery";
import shell from "./marketing-shell.module.css";
import styles from "./password-recovery.module.css";

export function PasswordRecovery({ mode }: { mode: "request" | "reset" }) {
  const router = useRouter();
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<StaticMessageKey | null>(null);
  const [ready, setReady] = useState(false);
  const recovery = useRef<ReturnType<typeof openRecoverySession> | null>(null);

  useEffect(() => {
    if (mode !== "reset") return;
    let active = true;
    if (!recovery.current) {
      const hash = window.location.hash;
      window.history.replaceState(null, "", window.location.pathname);
      recovery.current = openRecoverySession(hash);
    }
    void recovery.current.then(() => { if (active) setReady(true); }, () => { if (active) setError("recovery.invalid"); });
    return () => { active = false; };
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || done) return;
    setError(null);
    if (mode === "reset") {
      if (!ready) return;
      if (!password.trim() || password.length < 8) { setError("recovery.short"); return; }
      if (password !== confirmation) { setError("recovery.mismatch"); return; }
    }
    setBusy(true);
    try {
      if (mode === "request") {
        const { error: failure } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (failure) throw failure;
      } else {
        const client = await recovery.current;
        if (!client) throw new Error("No recovery session");
        const { error: failure } = await client.auth.updateUser({ password });
        if (failure) throw failure;
        setPassword("");
        setConfirmation("");
        // A logout transport failure must not misreport an already saved password.
        await client.auth.signOut({ scope: "local" }).catch(() => undefined);
        recovery.current = null;
      }
      setDone(true);
    } catch {
      setError(mode === "request" ? "recovery.sendFailed" : "recovery.saveFailed");
    } finally { setBusy(false); }
  }

  return <div className={shell.scope}>
    <LandingHeader onSignIn={() => router.push("/?signin=1")} onGetStarted={() => router.push("/?signup=1")} />
    <main className={styles.main}>
      <h1>{t(mode === "request" ? "recovery.title" : "recovery.resetTitle")}</h1>
      <p>{t(mode === "request" ? "recovery.intro" : "recovery.resetIntro")}</p>
      {error && <p role="alert" className={styles.error}>{t(error)}</p>}
      {done ? <p role="status">{t(mode === "request" ? "recovery.sent" : "recovery.saved")}</p> :
        mode === "reset" && !ready ? <>{!error && <p role="status">{t("recovery.checking")}</p>}</> :
        <form onSubmit={submit} className={styles.form}>
          {mode === "request" ? <label className="field">{t("landing.auth.email")}<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy} /></label> : <>
            <label className="field">{t("recovery.newPassword")}<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></label>
            <label className="field">{t("recovery.confirmPassword")}<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></label>
          </>}
          <button type="submit" disabled={busy}>{t(busy ? "landing.auth.wait" : mode === "request" ? "recovery.send" : "recovery.save")}</button>
        </form>}
      <div className={styles.links}>
        <Link href="/?signin=1">{t("recovery.back")}</Link>
        {mode === "reset" && !done && <Link href="/forgot-password">{t("recovery.retry")}</Link>}
      </div>
    </main>
  </div>;
}
