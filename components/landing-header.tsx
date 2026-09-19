"use client";

import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";

type LandingHeaderProps = {
  home?: boolean;
  signedInAs?: string;
  busy?: boolean;
  onSignIn: () => void;
  onGetStarted: () => void;
  onAccount?: () => void;
  onSignOut?: () => void;
};

export function LandingHeader({ home = false, signedInAs = "", busy = false, onSignIn, onGetStarted, onAccount, onSignOut }: LandingHeaderProps) {
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => message(locale, key);
  return (
      <header className="landing-header">
        <div className="landing-wrap landing-header-row">
          <div className="landing-brand">
            <svg className="landing-brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
              <rect x="2" y="4" width="60" height="8" />
              <rect className="landing-brand-mark-accent" x="2" y="16" width="60" height="8" />
              <rect x="2" y="28" width="60" height="8" />
            </svg>
            <span className="landing-brand-text">LockStock</span>
          </div>
          <nav className="landing-nav">
            <a href={home ? "#features" : "/#features"}>{t("nav.features")}</a>
            <a href={home ? "#benefits" : "/#benefits"}>{t("nav.benefits")}</a>
            <a href="/pricing">{t("nav.pricing")}</a>
            <Link href="/france-pme">{t("france.nav.pme")}</Link>
          </nav>
          <div className="landing-actions">
            <LanguageSwitcher />
            {signedInAs ? (
              <>
                <button type="button" className="ghost-btn" onClick={onAccount}>
                  {t("auth.account")}
                </button>
                <button type="button" onClick={onSignOut} disabled={busy}>
                  {t("auth.signOut")}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="ghost-btn" onClick={onSignIn}>
                  {t("auth.signIn")}
                </button>
                <button type="button" onClick={onGetStarted}>
                  {t("auth.getStarted")}
                </button>
              </>
            )}
          </div>
        </div>
      </header>
  );
}
