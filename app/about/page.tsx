import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = {
  title: "About | LockStock",
  description: "Learn about the LockStock team and its experience across IT, finance, construction, and supply chain."
};

export default function AboutPage() {
  return (
    <div className="landing-page about-page">
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

      <main className="about-main">
        <section className="about-hero">
          <div className="landing-wrap about-hero-grid">
            <div>
              <p className="about-eyebrow">About LockStock</p>
              <h1>Built by operators, technologists, and industry specialists</h1>
            </div>
            <div className="about-copy">
              <p>
                LockStock is shaped by a team with wide experience across several industries and markets. Our work brings
                together practical operating knowledge, product discipline, and technical delivery gained from projects in
                France and around the world.
              </p>
              <p>
                We have deep expertise in IT, finance, construction, and supply chain, which helps us understand how stock,
                purchasing, vendors, sites, approvals, and reporting connect in real organizations. That mix of backgrounds
                keeps the product focused on daily operational clarity rather than abstract software features.
              </p>
              <p>
                Our goal is to give teams a dependable system for managing materials and inventory across warehouses,
                projects, offices, and field operations. We design LockStock to support local French business needs while
                remaining practical for companies working internationally.
              </p>
            </div>
          </div>
        </section>

        <section className="about-industries">
          <div className="landing-wrap about-industry-grid" aria-label="Team expertise">
            {["IT", "Finance", "Construction", "Supply Chain"].map((industry) => (
              <article key={industry}>
                <span>{industry}</span>
              </article>
            ))}
          </div>
        </section>
      </main>

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
            <Link href="/#features">Features</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/inventory">App</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link href="/about">About</Link>
            <Link href="/#benefits">Blog</Link>
            <Link href="/#benefits">Contact</Link>
          </div>
          <div>
            <h4>Legal</h4>
            <Link href="/#pricing">Privacy Policy</Link>
            <Link href="/#pricing">Terms of Service</Link>
            <Link href="/#pricing">Security</Link>
          </div>
        </div>
        <div className="landing-wrap landing-footer-bottom">(c) 2026 LockStock. All rights reserved.</div>
      </footer>
    </div>
  );
}
