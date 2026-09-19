"use client";

import { useRef, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { message } from "@/lib/i18n";
import { startGoogleSignIn, type GoogleOnboarding } from "@/lib/auth/google";

export function GoogleSignInButton({ intent, disabled, className = "ghost-btn" }: {
  intent?: Partial<GoogleOnboarding> & { returnTo?: string };
  disabled?: boolean;
  className?: string;
}) {
  const { locale } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pending = useRef(false);
  async function signIn() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setFailed(false);
    try {
      await startGoogleSignIn({ returnTo: window.location.pathname + window.location.search, ...intent });
    } catch {
      setFailed(true);
      pending.current = false; setBusy(false);
    }
  }
  return <>
    <button type="button" className={className} disabled={disabled || busy} onClick={() => void signIn()}>
      {message(locale, busy ? "landing.auth.wait" : "landing.auth.google")}
    </button>
    {failed && <p role="alert">{message(locale, "google.failed")}</p>}
  </>;
}
