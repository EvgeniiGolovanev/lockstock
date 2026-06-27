import type { Metadata } from "next";
import Link from "next/link";
import { FranceCampaignShell } from "@/components/france-campaign-shell";
import {
  franceCampaignPromise,
  franceCampaignSegments,
  franceSeoUseCases
} from "@/lib/marketing/france";

export const metadata: Metadata = {
  title: "Logiciel gestion stock PME France | LockStock",
  description:
    "LockStock aide les PME francaises a remplacer Excel pour le suivi des stocks, achats, fournisseurs et emplacements."
};

export default function FrancePmePage() {
  return (
    <FranceCampaignShell>
      <main className="france-campaign-main">
        <section className="france-hero">
          <div className="landing-wrap france-hero-grid">
            <div>
              <p className="about-eyebrow">PME France</p>
              <h1>Remplacez Excel pour gerer stocks, achats et fournisseurs</h1>
              <p className="france-hero-copy">{franceCampaignPromise}</p>
              <div className="landing-hero-actions">
                <Link className="ghost-btn france-primary-link" href="/contact">
                  Demander une demo
                </Link>
                <Link className="ghost-btn" href="/france-pme/checklist-audit-stock">
                  Obtenir la checklist
                </Link>
              </div>
              <ul className="landing-checks">
                <li>Essai gratuit 14 jours</li>
                <li>Prix en EUR hors TVA</li>
                <li>Stock, achats, roles et audit dans un seul espace</li>
              </ul>
            </div>
            <aside className="france-command-board" aria-label="Exemple de mise en route LockStock">
              <div>
                <span>Mise en route</span>
                <strong>Testez LockStock sur un perimetre simple</strong>
              </div>
              <dl>
                <div>
                  <dt>Articles</dt>
                  <dd>10 references critiques</dd>
                </div>
                <div>
                  <dt>Emplacement</dt>
                  <dd>Un depot, chantier ou atelier</dd>
                </div>
                <div>
                  <dt>Achat</dt>
                  <dd>Un fournisseur et une commande ouverte</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="landing-section france-segments-section">
          <div className="landing-wrap">
            <div className="landing-section-head">
              <h2>Trois verticals a tester en priorite</h2>
              <p>Chaque page concentre les mots-cles, douleurs et appels a l&apos;action d&apos;un segment PME francais.</p>
            </div>
            <div className="france-segment-grid">
              {franceCampaignSegments.map((segment) => (
                <article key={segment.slug} className="france-segment-card">
                  <p className="about-eyebrow">{segment.eyebrow}</p>
                  <h3>{segment.title}</h3>
                  <p>{segment.description}</p>
                  <ul>
                    {segment.outcomes.map((outcome) => (
                      <li key={outcome}>{outcome}</li>
                    ))}
                  </ul>
                  <Link className="ghost-btn" href={`/france-pme/${segment.slug}`}>
                    {segment.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section france-seo-section">
          <div className="landing-wrap france-two-column">
            <div>
              <p className="about-eyebrow">Cas d&apos;usage</p>
              <h2>Les workflows stock essentiels pour une PME</h2>
              <p>
                Centralisez la gestion du stock, remplacez les fichiers Excel disperses et suivez les commandes
                fournisseurs sur plusieurs emplacements.
              </p>
            </div>
            <div className="france-usecase-list">
              {franceSeoUseCases.map((useCase) => (
                <article key={useCase.slug}>
                  <h3>{useCase.title}</h3>
                  <p>{useCase.description}</p>
                  <small>Cas d&apos;usage LockStock</small>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </FranceCampaignShell>
  );
}
