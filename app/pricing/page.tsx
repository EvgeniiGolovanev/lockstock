import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TranslatedMessage } from "@/components/translated-message";
import { buildPricingCards, buildPricingLimitRows } from "@/lib/billing/plan-contract";
import styles from "./page.module.css";
import shellStyles from "@/components/marketing-shell.module.css";

export const metadata: Metadata = {
  title: "Pricing | LockStock",
  description: "Compare LockStock plans for inventory, purchasing, teams, audit logs, and operational limits."
};

const plans = buildPricingCards();
const limitRows = buildPricingLimitRows();

export default function PricingPage() {
  return (
    <div className={shellStyles.scope}>
      <header className="landing-header">
        <div className="landing-wrap landing-header-row">
          <Link className={`landing-brand ${styles.brandLink}`} href="/">
            <svg className="landing-brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
              <rect x="2" y="4" width="60" height="8" />
              <rect className="landing-brand-mark-accent" x="2" y="16" width="60" height="8" />
              <rect x="2" y="28" width="60" height="8" />
            </svg>
            <span className="landing-brand-text">LockStock</span>
          </Link>
          <nav className="landing-nav">
            <Link href="/#features"><TranslatedMessage id="pricing.features" /></Link>
            <Link href="/#benefits"><TranslatedMessage id="pricing.benefits" /></Link>
            <Link href="/pricing"><TranslatedMessage id="pricing.nav" /></Link>
          </nav>
          <div className="landing-actions">
            <LanguageSwitcher />
            <Link className="ghost-btn" href="/">
              <TranslatedMessage id="pricing.home" />
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`landing-wrap ${styles.heroGrid}`}>
            <div>
              <p className={styles.eyebrow}><TranslatedMessage id="pricing.eyebrow" /></p>
              <h1><TranslatedMessage id="pricing.title" /></h1>
            </div>
            <div className={styles.heroCopy}>
              <p>
                <TranslatedMessage id="pricing.descriptionOne" />
              </p>
              <p>
                <TranslatedMessage id="pricing.descriptionTwo" />
              </p>
            </div>
          </div>
        </section>

        <section className={styles.plans} aria-label="LockStock pricing plans">
          <div className={`landing-wrap ${styles.planGrid}`}>
            {plans.map((plan) => (
              <article key={plan.id} className={`${styles.planCard}${plan.recommended ? ` ${styles.planCardFeatured}` : ""}`}>
                {plan.recommended ? <span className={styles.planBadge}><TranslatedMessage id="pricing.recommended" /></span> : null}
                <h2>{plan.title}</h2>
                <p>{plan.description}</p>
                <div className={styles.planPrice}>
                  {plan.priceLabel}
                  {plan.priceLabel !== "Custom" ? <span><TranslatedMessage id="pricing.monthlySuffix" /></span> : null}
                </div>
                <div className={styles.planAnnual}>
                  {plan.annualLabel}
                  {plan.id !== "enterprise" ? <TranslatedMessage id="pricing.chargedUpfront" /> : ""}
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

        <section className={styles.limits} aria-labelledby="pricing-limits-title">
          <div className="landing-wrap">
            <div className="landing-section-head">
              <h2 id="pricing-limits-title"><TranslatedMessage id="pricing.limitsTitle" /></h2>
              <p><TranslatedMessage id="pricing.limitsDescription" /></p>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col"><TranslatedMessage id="pricing.limit" /></th>
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
            <p className="landing-footer-text"><TranslatedMessage id="pricing.footerDescription" /></p>
          </div>
          <div>
            <h4><TranslatedMessage id="pricing.product" /></h4>
            <Link href="/#features"><TranslatedMessage id="pricing.features" /></Link>
            <Link href="/pricing"><TranslatedMessage id="pricing.nav" /></Link>
            <Link href="/inventory"><TranslatedMessage id="pricing.app" /></Link>
          </div>
          <div>
            <h4><TranslatedMessage id="pricing.company" /></h4>
            <Link href="/about"><TranslatedMessage id="pricing.about" /></Link>
            <Link href="/#benefits"><TranslatedMessage id="footer.blog" /></Link>
            <Link href="/#benefits"><TranslatedMessage id="pricing.contact" /></Link>
          </div>
          <div>
            <h4><TranslatedMessage id="pricing.legal" /></h4>
            <Link href="/privacy"><TranslatedMessage id="pricing.privacy" /></Link>
            <Link href="/terms"><TranslatedMessage id="pricing.terms" /></Link>
            <Link href="/security"><TranslatedMessage id="pricing.security" /></Link>
          </div>
        </div>
        <div className="landing-wrap landing-footer-bottom"><TranslatedMessage id="pricing.copyright" /></div>
      </footer>
    </div>
  );
}
