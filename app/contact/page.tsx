import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TranslatedMessage } from "@/components/translated-message";
import styles from "./page.module.css";
import shellStyles from "@/components/marketing-shell.module.css";

export const metadata: Metadata = {
  title: "Contact | LockStock",
  description: "Contact the LockStock team about inventory operations, purchasing workflows, and product questions."
};

export default function ContactPage() {
  return (
    <div className={shellStyles.scope} data-i18n-rendered="true">
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

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`landing-wrap ${styles.heroGrid}`}>
            <div>
              <p className={styles.eyebrow}><TranslatedMessage id="contact.eyebrow" /></p>
              <h1><TranslatedMessage id="contact.title" /></h1>
              <p className={styles.lede}>
                <TranslatedMessage id="contact.lede" />
              </p>
            </div>
            <div className={styles.panel}>
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
              <TranslatedMessage id="footer.tagline" />
            </p>
          </div>
          <div>
            <h4><TranslatedMessage id="footer.product" /></h4>
            <Link href="/#features"><TranslatedMessage id="nav.features" /></Link>
            <Link href="/#benefits"><TranslatedMessage id="nav.benefits" /></Link>
            <Link href="/pricing"><TranslatedMessage id="nav.pricing" /></Link>
          </div>
          <div>
            <h4><TranslatedMessage id="footer.company" /></h4>
            <Link href="/about"><TranslatedMessage id="footer.about" /></Link>
            <Link href="/contact"><TranslatedMessage id="footer.contact" /></Link>
            <Link href="/#pricing"><TranslatedMessage id="footer.privacy" /></Link>
            <Link href="/#pricing"><TranslatedMessage id="footer.terms" /></Link>
          </div>
        </div>
        <div className="landing-wrap landing-footer-bottom"><TranslatedMessage id="footer.copyright" /></div>
      </footer>
    </div>
  );
}
