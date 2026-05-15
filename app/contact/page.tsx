import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = {
  title: "Contact | LockStock",
  description: "Contact the LockStock team about inventory operations, purchasing workflows, and product questions."
};

export default function ContactPage() {
  return (
    <div className="landing-page contact-page">
      <header className="landing-header">
        <div className="landing-wrap landing-header-row">
          <Link className="landing-brand about-brand-link" href="/">
            <svg className="landing-brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
              <rect x="2" y="4" width="60" height="8" />
              <rect className="landing-brand-mark-accent" x="2" y="16" width="60" height="8" />
              <rect x="2" y="28" width="60" height="8" />
            </svg>
            <span className="landing-brand-text">LockStock</span>
          </Link>
          <nav className="landing-nav">
            <Link href="/#features">Features</Link>
            <Link href="/#benefits">Benefits</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
          <div className="landing-actions">
            <LanguageSwitcher />
            <Link className="ghost-btn" href="/">
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="contact-main">
        <section className="contact-hero">
          <div className="landing-wrap contact-hero-grid">
            <div>
              <p className="about-eyebrow">Contact LockStock</p>
              <h1>Talk to us about your inventory operations</h1>
              <p className="contact-lede">
                Send a note to the team for product questions, onboarding needs, or operational workflow discussions.
              </p>
            </div>
            <div className="contact-panel">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

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
              Modern inventory management for modern businesses. Track, manage, and optimize your stock with ease.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <Link href="/#features">Features</Link>
            <Link href="/#benefits">Benefits</Link>
            <Link href="/pricing">Pricing</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/#pricing">Privacy Policy</Link>
            <Link href="/#pricing">Terms of Service</Link>
          </div>
        </div>
        <div className="landing-wrap landing-footer-bottom">(c) 2026 LockStock. All rights reserved.</div>
      </footer>
    </div>
  );
}
