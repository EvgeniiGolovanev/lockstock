import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = {
  title: "Pricing | LockStock",
  description: "Compare LockStock plans for inventory, purchasing, teams, audit logs, and operational limits."
};

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "EUR 49",
    annual: "EUR 39/mo, billed annually",
    description: "For small teams replacing spreadsheets.",
    highlight: false,
    features: ["3 users included", "3 stock locations", "500 materials/SKUs", "50 purchase orders per month"]
  },
  {
    id: "operations",
    name: "Operations",
    price: "EUR 109",
    annual: "EUR 89/mo, billed annually",
    description: "For teams running daily stock and purchasing workflows.",
    highlight: true,
    features: ["8 users included", "Unlimited locations", "5,000 materials/SKUs", "Audit CSV export"]
  },
  {
    id: "business",
    name: "Business",
    price: "EUR 219",
    annual: "EUR 179/mo, billed annually",
    description: "For multi-site teams that need controls and history.",
    highlight: false,
    features: ["20 users included", "3 workspaces", "25,000 materials/SKUs", "Onboarding session"]
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    annual: "Annual contract",
    description: "For larger organizations with custom security and support needs.",
    highlight: false,
    features: ["Custom users", "Custom workspaces", "Custom retention", "SLA options"]
  }
];

const limitRows = [
  ["Monthly price", "EUR 49", "EUR 109", "EUR 219", "Custom"],
  ["Annual equivalent", "EUR 39/mo", "EUR 89/mo", "EUR 179/mo", "Custom"],
  ["Included users", "3", "8", "20", "Custom"],
  ["Extra users", "EUR 9/user/mo", "EUR 9/user/mo", "EUR 7/user/mo", "Custom"],
  ["Organizations / workspaces", "1", "1", "3", "Custom"],
  ["Teams / groups", "1", "5", "20", "Custom"],
  ["Locations", "3", "Unlimited", "Unlimited", "Unlimited"],
  ["Materials / SKUs", "500", "5,000", "25,000", "Custom"],
  ["Suppliers / vendors", "50", "500", "2,500", "Custom"],
  ["Purchase orders / month", "50", "500", "2,500", "Custom"],
  ["Stock movements / month", "500", "10,000", "50,000", "Custom"],
  ["CSV material import", "100 rows/import", "1,000 rows/import", "10,000 rows/import", "Custom"],
  ["Low-stock alerts", "Included", "Included", "Included", "Included"],
  ["Stock-health report", "Included", "Included", "Included", "Included"],
  ["Workflow guides", "Included", "Included", "Included", "Included"],
  ["Audit log in app", "Own recent activity", "Latest 20 organization events", "Latest 20 organization events", "Custom"],
  ["Audit CSV export", "Not included", "90 days/export", "366 days/export", "Custom"],
  ["Data retention", "12 months", "36 months", "7 years", "Custom"],
  ["Support", "Email", "Priority email", "Priority + onboarding", "SLA / dedicated"]
];

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
              <article key={plan.name} className={`pricing-plan-card${plan.highlight ? " pricing-plan-card-featured" : ""}`}>
                {plan.highlight ? <span className="pricing-plan-badge">Recommended</span> : null}
                <h2>{plan.name}</h2>
                <p>{plan.description}</p>
                <div className="pricing-plan-price">
                  {plan.price}
                  {plan.price !== "Custom" ? <span>/mo excl. VAT</span> : null}
                </div>
                <div className="pricing-plan-annual">{plan.annual}{plan.id !== "enterprise" ? " · charged upfront" : ""}</div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link className="ghost-btn" href={plan.id === "enterprise" ? "/contact" : `/payment?onboarding=paid&plan=${plan.id}`}>
                  {plan.id === "enterprise" ? "Contact sales" : "Choose plan"}
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
