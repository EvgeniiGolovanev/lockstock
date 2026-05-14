"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { buildSignUpPayload } from "@/lib/auth/signup";
import { demoVideoHref } from "@/lib/ui/demo-video";

type AuthMode = "signin" | "signup";

const FEATURES = [
  {
    title: "Material Catalog",
    description: "Manage SKUs, units of measure, categories, descriptions, and minimum stock thresholds in one clean catalog."
  },
  {
    title: "Location-Level Inventory",
    description: "Track stock quantities by warehouse, zone, rack, or site location so teams know where every material sits."
  },
  {
    title: "Stock Movement Control",
    description: "Record adjustments, consumption, transfers, and purchase receipts with structured movement reasons and history."
  },
  {
    title: "Purchase Order Lifecycle",
    description: "Create supplier purchase orders, move them through draft, sent, partial, received, and cancelled states, and receive stock against them."
  },
  {
    title: "Supplier Management",
    description: "Maintain vendor records, contact details, addresses, lead times, and supplier activity tied to purchasing workflows."
  },
  {
    title: "Groups, Roles, and Audit Trail",
    description: "Invite team members, manage roles, switch between groups, and review operational activity through audit logs."
  }
];

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Operations Manager",
    company: "TechSupply Co",
    content:
      "LockStock transformed our inventory management. We reduced stockouts dramatically and purchasing is now structured.",
    rating: 5
  },
  {
    name: "Michael Rodriguez",
    role: "CEO",
    company: "FastParts Inc",
    content:
      "The live analytics gave us visibility we never had before. We make better decisions and turnover improved.",
    rating: 5
  },
  {
    name: "Emily Thompson",
    role: "Warehouse Director",
    company: "GlobalDistribute",
    content: "Easy to use and powerful. The team can manage stock from anywhere without losing control.",
    rating: 5
  }
];

function StaticProductScreenshot({ variant }: { variant: "inventory" | "orders" }) {
  const isInventory = variant === "inventory";
  const rows = isInventory
    ? [
        ["MAT-001", "Portland Cement", "180", "Main", "In Stock"],
        ["MAT-024", "Rebar 12mm", "9", "North", "Low"],
        ["MAT-112", "Membrane", "47", "Rack B4", "In Stock"],
        ["MAT-230", "Anchor Bolt", "0", "Overflow", "Out"]
      ]
    : [
        ["PO-1048", "Acme Supply", "Partial", "EUR 8,240"],
        ["PO-1049", "Nord Steel", "Sent", "EUR 12,900"],
        ["PO-1050", "BuildChem", "Draft", "EUR 3,440"]
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
            <p className="landing-shot-eyebrow">{isInventory ? "Live stock view" : "Purchasing command"}</p>
            <h3>{isInventory ? "Inventory" : "Purchase Orders"}</h3>
          </div>
          <span className="landing-shot-action">{isInventory ? "Add Movement" : "Create PO"}</span>
        </div>

        <div className="landing-shot-kpis">
          {(isInventory
            ? [
                ["Materials", "248"],
                ["Low Stock", "12"],
                ["Out", "4"],
                ["Value", "EUR 82k"]
              ]
            : [
                ["Draft", "5"],
                ["Sent", "11"],
                ["Partial", "2"],
                ["Value", "EUR 34k"]
              ]
          ).map(([label, value], index) => (
            <article key={label} className={index === 1 || (!isInventory && index === 2) ? "landing-shot-kpi hot" : "landing-shot-kpi"}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        <div className="landing-shot-table" aria-label={`${isInventory ? "Inventory" : "Purchase order"} screenshot preview`}>
          <div className={`landing-shot-table-row landing-shot-table-head ${isInventory ? "" : "landing-shot-table-row-orders"}`}>
            {(isInventory ? ["SKU", "Item", "Qty", "Location", "Status"] : ["PO", "Supplier", "Status", "Total"]).map((cell) => (
              <span key={cell}>{cell}</span>
            ))}
          </div>
          {rows.map((row) => (
            <div
              key={row[0]}
              className={`landing-shot-table-row ${isInventory ? "" : "landing-shot-table-row-orders"} ${
                row.includes("Low") || row.includes("Out") || row.includes("Partial") ? "alert" : ""
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
  const demoHref = demoVideoHref(locale);
  const [authOpen, setAuthOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [signedInAs, setSignedInAs] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const heading = useMemo(
    () => (authMode === "signin" ? "Welcome back" : "Create your account"),
    [authMode]
  );

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
          appOrigin: window.location.origin
        })
      );
      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        setAuthOpen(false);
        router.push("/inventory");
        return;
      }

      setMessage("Account created. Check your email to confirm, then sign in.");
      setAuthMode("signin");
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
    <div className="landing-page">
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
            <a href="#features">Features</a>
            <a href="#benefits">Benefits</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="landing-actions">
            <LanguageSwitcher />
            {signedInAs ? (
              <>
                <button type="button" className="ghost-btn" onClick={() => router.push("/account")}>
                  Account
                </button>
                <button type="button" onClick={handleSignOut} disabled={busy}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button type="button" className="ghost-btn" onClick={() => openAuth("signin")}>
                  Sign In
                </button>
                <button type="button" onClick={() => openAuth("signup")}>
                  Get Started
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
              Master Your Inventory with <span>LockStock</span>
            </h1>
            <p className="landing-hero-subtitle">
              Streamline inventory management with real-time tracking, automated reordering, and practical analytics.
            </p>

            <div className="landing-hero-actions">
              <button type="button" onClick={() => openAuth("signup")}>
                Start Free Trial
              </button>
              <button type="button" className="ghost-btn" onClick={() => setDemoOpen(true)}>
                Watch Demo
              </button>
            </div>

            <ul className="landing-checks">
              <li>No credit card required</li>
              <li>14-day free trial</li>
              <li>Cancel anytime</li>
            </ul>
          </div>

          <div className="landing-image-wrap">
            <StaticProductScreenshot variant="inventory" />
          </div>
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="landing-wrap">
          <div className="landing-section-head">
            <h2>Everything You Need to Manage Inventory</h2>
            <p>Powerful features designed to streamline operations and boost efficiency.</p>
          </div>
          <div className="landing-feature-grid">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="landing-feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="benefits" className="landing-section landing-benefits">
        <div className="landing-wrap landing-benefits-grid">
          <div>
            <h2>Reduce Costs, Increase Efficiency</h2>
            <p>
              LockStock gives materials teams the operating structure to control stock, purchasing, locations, suppliers,
              and group access from one workspace.
            </p>
            <div className="landing-benefit-list">
              <article>
                <h3>One Operational Source of Truth</h3>
                <p>Connect materials, locations, suppliers, purchase orders, and stock movements so teams stop working from scattered spreadsheets.</p>
              </article>
              <article>
                <h3>Cleaner Daily Stock Decisions</h3>
                <p>Use low-stock status, inventory filters, purchase order visibility, and movement history to decide what to reorder, receive, transfer, or consume.</p>
              </article>
              <article>
                <h3>Controlled Collaboration</h3>
                <p>Give growing teams structure with role-based access, member invitations, group workspaces, workflow guides, and audit exports.</p>
              </article>
            </div>
          </div>
          <div className="landing-image-wrap">
            <StaticProductScreenshot variant="orders" />
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-wrap">
          <div className="landing-section-head">
            <h2>Trusted by Leading Businesses</h2>
            <p>See what teams say about running inventory operations on LockStock.</p>
          </div>
          <div className="landing-testimonial-grid">
            {TESTIMONIALS.map((item) => (
              <article key={item.name} className="landing-testimonial-card">
                <div className="landing-stars" aria-label={`${item.rating} stars`}>
                  {"★★★★★"}
                </div>
                <p>&ldquo;{item.content}&rdquo;</p>
                <div className="landing-testimonial-meta">
                  <strong>{item.name}</strong>
                  <span>{item.role}</span>
                  <span>{item.company}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="landing-cta">
        <div className="landing-wrap landing-cta-card">
          <h2>Ready to Transform Your Inventory Management?</h2>
          <p>Join teams that rely on LockStock to run purchasing and stock operations with confidence.</p>
          <div className="landing-cta-actions">
            <button type="button" onClick={() => openAuth("signup")}>
              Start Free Trial
            </button>
            <button type="button" className="ghost-btn" onClick={() => setDemoOpen(true)}>
              Watch Demo
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-grid">
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
              Modern inventory management for modern businesses. Track, manage, and optimize your stock with ease.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="/inventory">App</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="/about">About</a>
            <a href="#benefits">Blog</a>
            <a href="#benefits">Contact</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="#pricing">Privacy Policy</a>
            <a href="#pricing">Terms of Service</a>
            <a href="#pricing">Security</a>
          </div>
        </div>
        <div className="landing-wrap landing-footer-bottom">(c) 2026 LockStock. All rights reserved.</div>
      </footer>

      {authOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={heading}>
          <div className="modal-card landing-auth-card">
            <div className="title-row">
              <h4>{heading}</h4>
              <button type="button" className="ghost-btn" onClick={() => setAuthOpen(false)}>
                Close
              </button>
            </div>

            <form className="grid landing-auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" ? (
                <div className="grid grid-2">
                  <label className="field">
                    <span>Full Name</span>
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Company Name</span>
                    <input value={company} onChange={(event) => setCompany(event.target.value)} required />
                  </label>
                </div>
              ) : null}

              <label className="field">
                <span>Email</span>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <label className="field">
                <span>Password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>

              {error ? <p className="landing-auth-error">{error}</p> : null}
              {message ? <p className="landing-auth-message">{message}</p> : null}

              <button type="submit" disabled={busy || !email || !password}>
                {busy ? "Please wait..." : authMode === "signin" ? "Sign In" : "Create Account"}
              </button>

              <div className="landing-auth-divider">
                <span>or</span>
              </div>

              <button type="button" className="ghost-btn landing-google-btn" disabled>
                Continue with Google
              </button>

              <p className="landing-auth-switch">
                {authMode === "signup" ? "Already have an account? " : "Don&apos;t have an account? "}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setAuthMode((mode) => (mode === "signin" ? "signup" : "signin"))}
                >
                  {authMode === "signup" ? "Sign in" : "Sign up"}
                </button>
              </p>
            </form>
          </div>
        </div>
      ) : null}

      {demoOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Watch Demo">
          <div className="modal-card landing-demo-card">
            <div className="title-row">
              <h4>Watch Demo</h4>
              <button type="button" className="ghost-btn" onClick={() => setDemoOpen(false)}>
                Close
              </button>
            </div>
            <video className="landing-demo-video" src={demoHref} controls autoPlay playsInline />
          </div>
        </div>
      ) : null}
    </div>
  );
}
