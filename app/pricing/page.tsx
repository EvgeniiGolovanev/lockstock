import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { buildPricingCards, buildPricingLimitRows } from "@/lib/billing/plan-contract";

export const metadata: Metadata = {
  title: "Pricing | LockStock",
  description: "Compare LockStock plans for inventory, purchasing, teams, audit logs, and operational limits."
};

const plans = buildPricingCards();
const limitRows = buildPricingLimitRows();

export default function PricingPage() {
  return (
    <div className="landing-page pricing-page">
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

      <main className="pricing-main">
        <section className="pricing-hero">
          <div className="landing-wrap pricing-hero-grid">
            <div>
              <p className="about-eyebrow">Pricing</p>
              <h1>Plans for controlled inventory and purchasing operations</h1>
            </div>
            <div className="pricing-hero-copy">
              <p>
                Prices are listed in EUR, excluding VAT. Annual billing gives a lower monthly equivalent while keeping the
                same operational limits.
              </p>
              <p>
                Operations is the recommended plan for most teams because it unlocks unlimited locations, higher daily
                volume, team workflows, and audit exports.
              </p>
            </div>
          </div>
        </section>

        <section className="pricing-plans" aria-label="LockStock pricing plans">
          <div className="landing-wrap pricing-plan-grid">
            {plans.map((plan) => (
              <article key={plan.id} className={`pricing-plan-card${plan.recommended ? " pricing-plan-card-featured" : ""}`}>
                {plan.recommended ? <span className="pricing-plan-badge">Recommended</span> : null}
                <h2>{plan.title}</h2>
                <p>{plan.description}</p>
                <div className="pricing-plan-price">
                  {plan.priceLabel}
                  {plan.priceLabel !== "Custom" ? <span>/mo excl. VAT</span> : null}
                </div>
                <div className="pricing-plan-annual">
                  {plan.annualLabel}
                  {plan.id !== "enterprise" ? " · charged upfront" : ""}
                </div>
                <ul>
                  {plan.highlights.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link className="ghost-btn" href={plan.id === "enterprise" ? "/contact" : `/payment?onboarding=paid&plan=${plan.id}`}>
                  {plan.ctaLabel}
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="pricing-limits" aria-labelledby="pricing-limits-title">
          <div className="landing-wrap">
            <div className="landing-section-head">
              <h2 id="pricing-limits-title">Limits by Plan</h2>
              <p>Plan boundaries follow the current LockStock modules: teams, roles, locations, materials, suppliers, stock movements, purchase orders, imports, reports, and audit logs.</p>
            </div>
            <div className="pricing-table-wrap">
              <table className="pricing-table">
                <thead>
                  <tr>
                    <th scope="col">Limit</th>
                    <th scope="col">Starter</th>
                    <th scope="col">Operations</th>
                    <th scope="col">Business</th>
                    <th scope="col">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {limitRows.map(([label, starter, operations, business, enterprise]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{starter}</td>
                      <td>{operations}</td>
                      <td>{business}</td>
                      <td>{enterprise}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
