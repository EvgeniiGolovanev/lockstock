import type { Metadata } from "next";
import Link from "next/link";
import { FranceCampaignShell } from "@/components/france-campaign-shell";
import { FranceSegmentCards, FranceUseCaseCards } from "@/components/france-campaign-content";
import { TranslatedMessage } from "@/components/translated-message";
import styles from "@/components/france-campaign.module.css";

export const metadata: Metadata = {
  title: "Logiciel gestion stock PME France | LockStock",
  description:
    "LockStock aide les PME francaises a remplacer Excel pour le suivi des stocks, achats, fournisseurs et emplacements."
};

export default function FrancePmePage() {
  return (
    <FranceCampaignShell>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={`landing-wrap ${styles.heroGrid}`}>
            <div>
              <p className={styles.eyebrow}><TranslatedMessage id="france.home.eyebrow" /></p>
              <h1><TranslatedMessage id="france.home.title" /></h1>
              <p className={styles.heroCopy}><TranslatedMessage id="france.home.promise" /></p>
              <div className="landing-hero-actions">
                <Link className={`ghost-btn ${styles.primaryLink}`} href="/contact">
                  <TranslatedMessage id="france.requestDemo" />
                </Link>
                <Link className="ghost-btn" href="/france-pme/checklist-audit-stock">
                  <TranslatedMessage id="france.home.checklist" />
                </Link>
              </div>
              <ul className="landing-checks">
                <li><TranslatedMessage id="france.home.trial" /></li>
                <li><TranslatedMessage id="france.home.vat" /></li>
                <li><TranslatedMessage id="france.home.oneWorkspace" /></li>
              </ul>
            </div>
            <aside className={styles.commandBoard} aria-labelledby="france-setup-title">
              <div>
                <span><TranslatedMessage id="france.home.setup" /></span>
                <strong id="france-setup-title"><TranslatedMessage id="france.home.setupTitle" /></strong>
              </div>
              <dl>
                <div>
                  <dt><TranslatedMessage id="france.home.items" /></dt>
                  <dd><TranslatedMessage id="france.home.itemsValue" /></dd>
                </div>
                <div>
                  <dt><TranslatedMessage id="france.home.location" /></dt>
                  <dd><TranslatedMessage id="france.home.locationValue" /></dd>
                </div>
                <div>
                  <dt><TranslatedMessage id="france.home.purchase" /></dt>
                  <dd><TranslatedMessage id="france.home.purchaseValue" /></dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-wrap">
            <div className="landing-section-head">
              <h2><TranslatedMessage id="france.home.verticalTitle" /></h2>
              <p><TranslatedMessage id="france.home.verticalDescription" /></p>
            </div>
            <div className={styles.segmentGrid}>
              <FranceSegmentCards />
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className={`landing-wrap ${styles.twoColumn}`}>
            <div>
              <p className={styles.eyebrow}><TranslatedMessage id="france.home.useCases" /></p>
              <h2><TranslatedMessage id="france.home.workflows" /></h2>
              <p><TranslatedMessage id="france.home.workflowDescription" /></p>
            </div>
            <div className={styles.usecaseList}>
              <FranceUseCaseCards />
            </div>
          </div>
        </section>
      </main>
    </FranceCampaignShell>
  );
}
