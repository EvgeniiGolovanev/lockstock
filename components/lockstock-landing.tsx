"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type AuthMode = "signin" | "signup";

const FEATURES = [
  {
    title: "Real-Time Tracking",
    description: "Monitor your inventory levels in real-time across all locations with instant updates."
  },
  {
    title: "Automated Reordering",
    description: "Set reorder points and let the system automatically generate purchase orders."
  },
  {
    title: "Advanced Analytics",
    description: "Gain insights with reports and forecasting tools to optimize stock levels."
  },
  {
    title: "Smart Alerts",
    description: "Receive notifications for low stock, expiring items, and inventory discrepancies."
  },
  {
    title: "Secure and Compliant",
    description: "Enterprise-grade security with role-based access control and audit trails."
  },
  {
    title: "Mobile Ready",
    description: "Manage inventory on-the-go with responsive workflows and real-time updates."
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

export function LockstockLanding() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
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
      void supabase.auth.getSession().then(({ data, error }) => {
        if (unmounted || error) {
          return;
        }
        setSignedInAs(data.session?.user.email ?? "");
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company
          }
        }
      });
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
            <span className="landing-brand-mark">LS</span>
            <span className="landing-brand-text">LockStock</span>
          </div>
          <nav className="landing-nav">
            <a href="#features">Features</a>
            <a href="#benefits">Benefits</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="landing-actions">
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
              <button type="button" className="ghost-btn" onClick={() => openAuth("signin")}>
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
            <img
              src="https://images.unsplash.com/photo-1768796373577-2e6e51351165?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt="Warehouse inventory management"
              className="landing-image"
            />
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
              LockStock helps teams reduce inventory carrying costs while improving fill rate through practical workflow
              controls.
            </p>
            <div className="landing-benefit-list">
              <article>
                <h3>30% Cost Reduction</h3>
                <p>Optimize stock levels and reduce waste with clearer ordering decisions.</p>
              </article>
              <article>
                <h3>10x Faster Processing</h3>
                <p>Automate repetitive updates and speed up daily purchasing operations.</p>
              </article>
              <article>
                <h3>Better Collaboration</h3>
                <p>Keep teams aligned with shared data, role-based actions, and visible activity history.</p>
              </article>
            </div>
          </div>
          <div className="landing-image-wrap">
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
              alt="Inventory analytics dashboard"
              className="landing-image"
            />
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
            <button type="button" className="ghost-btn" onClick={() => openAuth("signin")}>
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-wrap landing-footer-grid">
          <div>
            <div className="landing-brand">
              <span className="landing-brand-mark">LS</span>
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
            <a href="#benefits">About</a>
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
    </div>
  );
}
