import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LocalizedDiv } from "@/components/localized-div";
import { TranslatedMessage } from "@/components/translated-message";

const INDUSTRY_MESSAGE_KEYS = [
  "about.industry.it",
  "about.industry.finance",
  "about.industry.construction",
  "about.industry.supplyChain"
] as const;

export const metadata: Metadata = {
  title: "About | LockStock",
  description: "Learn about the LockStock team and its experience across IT, finance, construction, and supply chain."
};

export default function AboutPage() {
  return (
    <div className="landing-page about-page" data-i18n-rendered="true">
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
            <Link href="/#features"><TranslatedMessage id="nav.features" /></Link>
            <Link href="/#benefits"><TranslatedMessage id="nav.benefits" /></Link>
            <Link href="/pricing"><TranslatedMessage id="nav.pricing" /></Link>
          </nav>
          <div className="landing-actions">
            <LanguageSwitcher />
            <Link className="ghost-btn" href="/">
              <TranslatedMessage id="nav.home" />
            </Link>
          </div>
        </div>
      </header>

      <main className="about-main">
        <section className="about-hero">
          <div className="landing-wrap about-hero-grid">
            <div>
              <p className="about-eyebrow"><TranslatedMessage id="about.eyebrow" /></p>
              <h1><TranslatedMessage id="about.title" /></h1>
            </div>
            <div className="about-copy">
              <p>
                <TranslatedMessage id="about.paragraphOne" />
              </p>
              <p>
                <TranslatedMessage id="about.paragraphTwo" />
              </p>
              <p>
                <TranslatedMessage id="about.paragraphThree" />
              </p>
            </div>
          </div>
        </section>

        <section className="about-industries">
          <LocalizedDiv className="landing-wrap about-industry-grid" labelKey="about.teamExpertise">
            {INDUSTRY_MESSAGE_KEYS.map((industry) => (
              <article key={industry}>
                <span><TranslatedMessage id={industry} /></span>
              </article>
            ))}
          </LocalizedDiv>
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
              <TranslatedMessage id="footer.tagline" />
            </p>
          </div>
          <div>
            <h4><TranslatedMessage id="footer.product" /></h4>
            <Link href="/#features"><TranslatedMessage id="nav.features" /></Link>
            <Link href="/pricing"><TranslatedMessage id="nav.pricing" /></Link>
            <Link href="/inventory"><TranslatedMessage id="footer.app" /></Link>
          </div>
          <div>
            <h4><TranslatedMessage id="footer.company" /></h4>
            <Link href="/about"><TranslatedMessage id="footer.about" /></Link>
            <Link href="/#benefits"><TranslatedMessage id="footer.blog" /></Link>
            <Link href="/contact"><TranslatedMessage id="footer.contact" /></Link>
          </div>
          <div>
            <h4><TranslatedMessage id="footer.legal" /></h4>
            <Link href="/#pricing"><TranslatedMessage id="footer.privacy" /></Link>
            <Link href="/#pricing"><TranslatedMessage id="footer.terms" /></Link>
            <Link href="/#pricing"><TranslatedMessage id="footer.security" /></Link>
          </div>
        </div>
        <div className="landing-wrap landing-footer-bottom"><TranslatedMessage id="footer.copyright" /></div>
      </footer>
    </div>
  );
}
