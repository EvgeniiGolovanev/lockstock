import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import { TranslatedMessage } from "@/components/translated-message";
import styles from "./france-campaign.module.css";
import shellStyles from "./marketing-shell.module.css";

export function FranceCampaignHeader() {
  return (
    <header className={`landing-header ${styles.campaignHeader}`}>
      <div className="landing-wrap landing-header-row">
        <Link className="landing-brand" href="/france-pme">
          <svg className="landing-brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
            <rect x="2" y="4" width="60" height="8" />
            <rect className="landing-brand-mark-accent" x="2" y="16" width="60" height="8" />
            <rect x="2" y="28" width="60" height="8" />
          </svg>
          <span className="landing-brand-text">LockStock</span>
        </Link>
        <nav className="landing-nav">
          <Link href="/france-pme"><TranslatedMessage id="france.nav.pme" /></Link>
          <Link href="/france-pme/construction-materiaux"><TranslatedMessage id="france.nav.construction" /></Link>
          <Link href="/france-pme/industrie-atelier"><TranslatedMessage id="france.nav.industry" /></Link>
          <Link href="/france-pme/maintenance-terrain"><TranslatedMessage id="france.nav.maintenance" /></Link>
        </nav>
        <div className="landing-actions">
          <LanguageSwitcher />
          <Link className="ghost-btn" href="/contact">
            <TranslatedMessage id="france.requestDemo" />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function FranceCampaignFooter() {
  return (
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
          <p className="landing-footer-text"><TranslatedMessage id="france.footerDescription" /></p>
        </div>
        <div>
          <h4><TranslatedMessage id="france.footerFrance" /></h4>
          <Link href="/#features"><TranslatedMessage id="france.product" /></Link>
          <Link href="/pricing"><TranslatedMessage id="france.pricing" /></Link>
          <Link href="/contact"><TranslatedMessage id="pricing.contact" /></Link>
          <Link href="/france-pme"><TranslatedMessage id="france.nav.pme" /></Link>
        </div>
        <div>
          <h4><TranslatedMessage id="france.resources" /></h4>
          <Link href="/france-pme/checklist-audit-stock"><TranslatedMessage id="france.auditChecklist" /></Link>
          <Link href="/france-pme/construction-materiaux"><TranslatedMessage id="france.constructionStock" /></Link>
          <Link href="/workflows"><TranslatedMessage id="france.workflowGuides" /></Link>
        </div>
      </div>
      <div className="landing-wrap landing-footer-bottom"><TranslatedMessage id="france.copyright" /></div>
    </footer>
  );
}

export function FranceCampaignShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={shellStyles.scope}>
      <FranceCampaignHeader />
      {children}
      <FranceCampaignFooter />
    </div>
  );
}
