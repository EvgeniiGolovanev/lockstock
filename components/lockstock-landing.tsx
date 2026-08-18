"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccessibilityDialog } from "@/components/accessibility-dialog";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { message as renderMessage, type StaticMessageKey } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { buildPostSignUpPath, buildSignUpPayload, rememberPostSignUpWorkspace } from "@/lib/auth/signup";
import { demoVideoHref } from "@/lib/ui/demo-video";
import authStyles from "./lockstock-landing-auth.module.css";
import shellStyles from "./marketing-shell.module.css";

type AuthMode = "signin" | "signup";
type SelectedPlan = "starter" | "operations" | "business" | "enterprise";

const FEATURE_MESSAGE_KEYS: Array<{ title: StaticMessageKey; description: StaticMessageKey }> = [
  {
    title: "landing.feature.catalog.title",
    description: "landing.feature.catalog.description"
  },
  {
    title: "landing.feature.inventory.title",
    description: "landing.feature.inventory.description"
  },
  {
    title: "landing.feature.movement.title",
    description: "landing.feature.movement.description"
  },
  {
    title: "landing.feature.purchaseOrders.title",
    description: "landing.feature.purchaseOrders.description"
  },
  {
    title: "landing.feature.suppliers.title",
    description: "landing.feature.suppliers.description"
  },
  {
    title: "landing.feature.collaboration.title",
    description: "landing.feature.collaboration.description"
  }
];

const TESTIMONIAL_MESSAGE_KEYS: Array<{ name: string; role: StaticMessageKey; company: string; content: StaticMessageKey; rating: number }> = [
  {
    name: "Sarah Chen",
    role: "landing.testimonial.operationsManager",
    company: "TechSupply Co",
    content: "landing.testimonial.one",
    rating: 5
  },
  {
    name: "Michael Rodriguez",
    role: "landing.testimonial.ceo",
    company: "FastParts Inc",
    content: "landing.testimonial.two",
    rating: 5
  },
  {
    name: "Emily Thompson",
    role: "landing.testimonial.warehouseDirector",
    company: "GlobalDistribute",
    content: "landing.testimonial.three",
    rating: 5
  }
];

function StaticProductScreenshot({ variant, locale }: { variant: "inventory" | "orders"; locale: "en" | "fr" }) {
  const isInventory = variant === "inventory";
  const t = (key: StaticMessageKey) => renderMessage(locale, key);
  const rows = isInventory
    ? [
        ["MAT-001", "Portland Cement", "180", "Main", t("landing.preview.inStock")],
        ["MAT-024", "Rebar 12mm", "9", "North", t("landing.preview.lowStock")],
        ["MAT-112", "Membrane", "47", "Rack B4", t("landing.preview.inStock")],
        ["MAT-230", "Anchor Bolt", "0", "Overflow", t("landing.preview.out")]
      ]
    : [
        ["PO-1048", "Acme Supply", t("landing.preview.partial"), "EUR 8,240"],
        ["PO-1049", "Nord Steel", t("landing.preview.sent"), "EUR 12,900"],
        ["PO-1050", "BuildChem", t("landing.preview.draft"), "EUR 3,440"]
      ];

  return (
    <div className={`landing-product-shot ${isInventory ? "landing-product-shot-inventory" : "landing-product-shot-orders"}`}>
      <div className="landing-shot-rail" aria-hidden="true">
        <span className="landing-shot-logo-line" />
        <span className="landing-shot-logo-line landing-shot-logo-line-accent" />
        <span className="landing-shot-logo-line" />
        <span className="landing-shot-nav landing-shot-nav-active" />
        <span className="landing-shot-nav" />
        <span className="landing-shot-nav" />
        <span className="landing-shot-nav" />
      </div>
      <div className="landing-shot-workspace">
        <div className="landing-shot-top">
          <div>
            <p className="landing-shot-eyebrow">{isInventory ? t("landing.preview.liveStock") : t("landing.preview.purchasing")}</p>
            <h3>{isInventory ? t("landing.preview.inventory") : t("landing.preview.purchaseOrders")}</h3>
          </div>
          <span className="landing-shot-action">{isInventory ? t("landing.preview.addMovement") : t("landing.preview.createPo")}</span>
        </div>

        <div className="landing-shot-kpis">
          {(isInventory
            ? [
                [t("landing.preview.materials"), "248"],
                [t("landing.preview.lowStock"), "12"],
                [t("landing.preview.out"), "4"],
                [t("landing.preview.value"), "EUR 82k"]
              ]
            : [
                [t("landing.preview.draft"), "5"],
                [t("landing.preview.sent"), "11"],
                [t("landing.preview.partial"), "2"],
                [t("landing.preview.value"), "EUR 34k"]
              ]
          ).map(([label, value], index) => (
            <article key={label} className={index === 1 || (!isInventory && index === 2) ? "landing-shot-kpi hot" : "landing-shot-kpi"}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        <div className="landing-shot-table" aria-label={isInventory ? t("landing.preview.screenshotInventory") : t("landing.preview.screenshotPo")}>
          <div className={`landing-shot-table-row landing-shot-table-head ${isInventory ? "" : "landing-shot-table-row-orders"}`}>
            {(isInventory ? [t("landing.preview.sku"), t("landing.preview.item"), t("landing.preview.qty"), t("landing.preview.location"), t("landing.preview.status")] : ["PO", t("landing.preview.supplier"), t("landing.preview.status"), t("landing.preview.total")]).map((cell) => (
              <span key={cell}>{cell}</span>
            ))}
          </div>
          {rows.map((row) => (
            <div
              key={row[0]}
              className={`landing-shot-table-row ${isInventory ? "" : "landing-shot-table-row-orders"} ${
                row.includes(t("landing.preview.lowStock")) || row.includes(t("landing.preview.out")) || row.includes(t("landing.preview.partial")) ? "alert" : ""
              }`}
            >
              {row.map((cell) => (
                <span key={`${row[0]}-${cell}`}>{cell}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LockstockLanding() {
  const router = useRouter();
  const { locale } = useLanguage();
  const t = (key: StaticMessageKey) => renderMessage(locale, key);
  const demoHref = demoVideoHref(locale);
  const [authOpen, setAuthOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [signedInAs, setSignedInAs] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>("starter");
  const [onboardingMode, setOnboardingMode] = useState<"trial" | "paid">("trial");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const authErrorId = useId();
  const authMessageId = useId();

  const heading = authMode === "signin" ? t("landing.auth.welcome") : t("landing.auth.createAccountTitle");

  useEffect(() => {
    const requestedPlan = new URLSearchParams(window.location.search).get("plan");
    if (["starter", "operations", "business", "enterprise"].includes(requestedPlan ?? "")) {
      setSelectedPlan(requestedPlan as SelectedPlan);
      setOnboardingMode("paid");
      setAuthMode("signup");
      setAuthOpen(true);
    }
  }, []);

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
          setSignedInAs(data.session?.user.email ?? "");
        })
        .catch(() => {
          if (unmounted) {
            return;
          }
          setSignedInAs("");
        });

      const authListener = supabase.auth.onAuthStateChange((_event, session) => {
        if (unmounted) {
          return;
        }
        setSignedInAs(session?.user.email ?? "");
      });

      unsubscribe = () => authListener.data.subscription.unsubscribe();
    } catch {
      setSignedInAs("");
    }

    return () => {
      unmounted = true;
      unsubscribe();
    };
  }, []);

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setError("");
    setMessage("");
    setAuthOpen(true);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setBusy(true);
      setError("");
      setMessage("");

      const supabase = getSupabaseBrowserClient();

      if (authMode === "signin") {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) {
          throw signInError;
        }
        void data;
        setAuthOpen(false);
        router.push("/inventory");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp(
        buildSignUpPayload({
          email,
          password,
          fullName,
          company,
          selectedPlan,
          onboardingMode,
          appOrigin: window.location.origin
        })
      );
      if (signUpError) {
        throw signUpError;
      }

      if (onboardingMode === "trial" && data.session?.access_token) {
        const response = await fetch("/api/billing/start-trial", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${data.session.access_token}`
          }
        });
        const payload = await response.json().catch(() => ({ error: "Failed to start trial." }));
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to start trial.");
        }
        rememberPostSignUpWorkspace(window.localStorage, payload.data?.orgId);
      }

      setAuthOpen(false);
      router.push(buildPostSignUpPath({ onboardingMode, selectedPlan }));
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    try {
      setBusy(true);
      const supabase = getSupabaseBrowserClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }
      setSignedInAs("");
      router.refresh();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={shellStyles.scope} data-i18n-rendered="true">
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
            <a href="#features">{t("nav.features")}</a>
            <a href="#benefits">{t("nav.benefits")}</a>
            <a href="/pricing">{t("nav.pricing")}</a>
            <Link href="/france-pme">{t("france.nav.pme")}</Link>
          </nav>
          <div className="landing-actions">
            <LanguageSwitcher />
            {signedInAs ? (
              <>
                <button type="button" className="ghost-btn" onClick={() => router.push("/account")}>
                  {t("auth.account")}
                </button>
                <button type="button" onClick={handleSignOut} disabled={busy}>
                  {t("auth.signOut")}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="ghost-btn" onClick={() => openAuth("signin")}>
                  {t("auth.signIn")}
                </button>
                <button type="button" onClick={() => openAuth("signup")}>
                  {t("auth.getStarted")}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-wrap landing-hero-grid">
          <div>
            <h1 className="landing-hero-title">
              {t("landing.hero.title")} <span>LockStock</span>
            </h1>
            <p className="landing-hero-subtitle">
              {t("landing.hero.subtitle")}
            </p>

            <div className="landing-hero-actions">
              <button type="button" onClick={() => openAuth("signup")}>
                {t("landing.startTrial")}
              </button>
              <button type="button" className="ghost-btn" onClick={() => setDemoOpen(true)}>
                {t("landing.watchDemo")}
              </button>
            </div>

            <ul className="landing-checks">
              <li>{t("landing.noCard")}</li>
              <li>{t("landing.trialLength")}</li>
              <li>{t("landing.cancelAnytime")}</li>
            </ul>
          </div>

          <div className="landing-image-wrap">
            <StaticProductScreenshot variant="inventory" locale={locale} />
          </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="landing-wrap">
          <div className="landing-section-head">
            <h2>{t("landing.features.title")}</h2>
            <p>{t("landing.features.subtitle")}</p>
          </div>
          <div className="landing-feature-grid">
            {FEATURE_MESSAGE_KEYS.map((feature) => (
              <article key={feature.title} className="landing-feature-card">
                <h3>{t(feature.title)}</h3>
                <p>{t(feature.description)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="landing-section landing-benefits">
        <div className="landing-wrap landing-benefits-grid">
          <div>
            <h2>{t("landing.benefits.title")}</h2>
            <p>
              {t("landing.benefits.lede")}
            </p>
            <div className="landing-benefit-list">
              <article>
                <h3>{t("landing.benefit.truth.title")}</h3>
                <p>{t("landing.benefit.truth.description")}</p>
              </article>
              <article>
                <h3>{t("landing.benefit.decisions.title")}</h3>
                <p>{t("landing.benefit.decisions.description")}</p>
              </article>
              <article>
                <h3>{t("landing.benefit.collaboration.title")}</h3>
                <p>{t("landing.benefit.collaboration.description")}</p>
              </article>
            </div>
          </div>
          <div className="landing-image-wrap">
            <StaticProductScreenshot variant="orders" locale={locale} />
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-wrap">
          <div className="landing-section-head">
            <h2>{t("landing.testimonials.title")}</h2>
            <p>{t("landing.testimonials.subtitle")}</p>
          </div>
          <div className="landing-testimonial-grid">
            {TESTIMONIAL_MESSAGE_KEYS.map((item) => (
              <article key={item.name} className="landing-testimonial-card">
                <div className="landing-stars" aria-label={`${item.rating} stars`}>
                  {"★★★★★"}
                </div>
                <p>&ldquo;{t(item.content)}&rdquo;</p>
                <div className="landing-testimonial-meta">
                  <strong>{item.name}</strong>
                  <span>{t(item.role)}</span>
                  <span>{item.company}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-cta">
        <div className="landing-wrap landing-cta-card">
          <h2>{t("landing.cta.title")}</h2>
          <p>{t("landing.cta.description")}</p>
          <div className="landing-cta-actions">
            <button type="button" onClick={() => openAuth("signup")}>
              {t("landing.startTrial")}
            </button>
            <button type="button" className="ghost-btn" onClick={() => setDemoOpen(true)}>
              {t("landing.watchDemo")}
            </button>
            <a className="ghost-btn" href="/pricing">
              {t("landing.viewPricing")}
            </a>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-grid landing-footer-grid-compact">
          <div>
            <div className="landing-brand">
              <svg className="landing-brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
                <rect x="2" y="4" width="60" height="8" />
                <rect className="landing-brand-mark-accent" x="2" y="16" width="60" height="8" />
                <rect x="2" y="28" width="60" height="8" />
              </svg>
              <span className="landing-brand-text">LockStock</span>
            </div>
            <p className="landing-footer-text">
              {t("footer.tagline")}
            </p>
          </div>
          <div>
            <h4>{t("footer.product")}</h4>
            <a href="#features">{t("nav.features")}</a>
            <a href="#benefits">{t("nav.benefits")}</a>
            <a href="/pricing">{t("nav.pricing")}</a>
            <Link href="/france-pme">{t("france.nav.pme")}</Link>
          </div>
          <div>
            <h4>{t("footer.company")}</h4>
            <a href="/about">{t("footer.about")}</a>
            <a href="/contact">{t("footer.contact")}</a>
            <a href="#pricing">{t("footer.privacy")}</a>
            <a href="#pricing">{t("footer.terms")}</a>
          </div>
        </div>
        <div className="landing-wrap landing-footer-bottom">{t("footer.copyright")}</div>
      </footer>

      {authOpen ? (
        <AccessibilityDialog
          title={heading}
          closeLabel={t("common.close")}
          closeAriaLabel={t("landing.dialog.close")}
          onClose={() => setAuthOpen(false)}
        >
          <form className={`grid ${authStyles.form}`} onSubmit={handleAuthSubmit}>
            {authMode === "signup" ? (
              <div className="grid grid-2">
                <label className="field">
                  <span>{t("landing.auth.fullName")}</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                </label>
                <label className="field">
                  <span>{t("landing.auth.companyName")}</span>
                  <input value={company} onChange={(event) => setCompany(event.target.value)} required />
                </label>
                <label className="field">
                  <span>{t("landing.auth.startWith")}</span>
                  <select value={onboardingMode} onChange={(event) => setOnboardingMode(event.target.value as "trial" | "paid")}>
                    <option value="trial">{t("landing.auth.starterTrial")}</option>
                    <option value="paid">{t("landing.auth.paidPlan")}</option>
                  </select>
                </label>
                {onboardingMode === "paid" ? (
                  <label className="field">
                    <span>{t("landing.auth.preferredPlan")}</span>
                    <select value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as SelectedPlan)}>
                      <option value="starter">Starter</option>
                      <option value="operations">Operations</option>
                      <option value="business">Business</option>
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            <label className="field">
              <span>{t("landing.auth.email")}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                aria-describedby={error ? authErrorId : undefined}
              />
            </label>
            <label className="field">
              <span>{t("landing.auth.password")}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                aria-describedby={error ? authErrorId : undefined}
              />
            </label>

            {error ? (
              <p id={authErrorId} className={authStyles.error} role="alert">
                {error}
              </p>
            ) : null}
            {message ? (
              <p id={authMessageId} className={authStyles.message} role="status" aria-live="polite">
                {message}
              </p>
            ) : null}

            <button type="submit" disabled={busy || !email || !password}>
              {busy ? t("landing.auth.wait") : authMode === "signin" ? t("auth.signIn") : t("landing.auth.createAccount")}
            </button>

            <div className={authStyles.divider}>
              <span>{t("landing.auth.or")}</span>
            </div>

            <button type="button" className={`ghost-btn ${authStyles.googleButton}`} disabled>
              {t("landing.auth.google")}
            </button>

            <p className={authStyles.switch}>
              {authMode === "signup" ? `${t("landing.auth.alreadyHaveAccount")} ` : `${t("landing.auth.noAccount")} `}
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setAuthMode((mode) => (mode === "signin" ? "signup" : "signin"))}
              >
                {authMode === "signup" ? t("auth.signIn") : t("landing.auth.signUp")}
              </button>
            </p>
          </form>
        </AccessibilityDialog>
      ) : null}

      {demoOpen ? (
        <AccessibilityDialog
          title={t("landing.demo.title")}
          closeLabel={t("common.close")}
          closeAriaLabel={t("landing.dialog.close")}
          onClose={() => setDemoOpen(false)}
        >
          <video className={authStyles.demoVideo} src={demoHref} controls autoPlay playsInline />
        </AccessibilityDialog>
      ) : null}
    </div>
  );
}
