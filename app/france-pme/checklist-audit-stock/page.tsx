import type { Metadata } from "next";
import Link from "next/link";
import { FranceCampaignShell } from "@/components/france-campaign-shell";
import { TranslatedMessage } from "@/components/translated-message";
import type { StaticMessageKey } from "@/lib/i18n";

const checklistSections = [
  {
    title: "france.checklist.data.title",
    items: ["france.checklist.data.one", "france.checklist.data.two", "france.checklist.data.three"]
  },
  {
    title: "france.checklist.locations.title",
    items: ["france.checklist.locations.one", "france.checklist.locations.two", "france.checklist.locations.three"]
  },
  {
    title: "france.checklist.purchasing.title",
    items: ["france.checklist.purchasing.one", "france.checklist.purchasing.two", "france.checklist.purchasing.three"]
  },
  {
    title: "france.checklist.governance.title",
    items: ["france.checklist.governance.one", "france.checklist.governance.two", "france.checklist.governance.three"]
  }
] as const satisfies ReadonlyArray<{ title: StaticMessageKey; items: readonly StaticMessageKey[] }>;

export const metadata: Metadata = {
  title: "Checklist audit stock PME | LockStock",
  description: "Checklist en 20 points pour auditer la gestion de stock d'une PME francaise avant de remplacer Excel."
};

export default function ChecklistAuditStockPage() {
  return (
    <FranceCampaignShell>
      <main className="france-campaign-main">
        <section className="france-hero france-checklist-hero">
          <div className="landing-wrap france-hero-grid">
            <div>
              <p className="about-eyebrow"><TranslatedMessage id="france.checklist.eyebrow" /></p>
              <h1><TranslatedMessage id="france.checklist.title" /></h1>
              <p className="france-hero-copy"><TranslatedMessage id="france.checklist.description" /></p>
              <div className="landing-hero-actions">
                <Link className="ghost-btn france-primary-link" href="/contact">
                  <TranslatedMessage id="france.checklist.guidedVersion" />
                </Link>
                <Link className="ghost-btn" href="/france-pme">
                  <TranslatedMessage id="france.checklist.discover" />
                </Link>
              </div>
            </div>
            <aside className="france-command-board">
              <span><TranslatedMessage id="france.checklist.result" /></span>
              <strong><TranslatedMessage id="france.checklist.resultTitle" /></strong>
              <p><TranslatedMessage id="france.checklist.resultDescription" /></p>
            </aside>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-wrap france-checklist-grid">
            {checklistSections.map((section, sectionIndex) => (
              <article key={section.title} className="france-checklist-card">
                <h2><TranslatedMessage id={section.title} /></h2>
                <ol start={sectionIndex * 5 + 1}>
                  {section.items.map((item) => (
                    <li key={item}><TranslatedMessage id={item} /></li>
                  ))}
                  <li><TranslatedMessage id="france.checklist.owner" /></li>
                  <li><TranslatedMessage id="france.checklist.measure" /></li>
                </ol>
              </article>
            ))}
          </div>
        </section>
      </main>
    </FranceCampaignShell>
  );
}
