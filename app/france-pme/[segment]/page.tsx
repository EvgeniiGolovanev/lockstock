import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FranceCampaignShell } from "@/components/france-campaign-shell";
import { franceCampaignSegments, getFranceCampaignSegment } from "@/lib/marketing/france";

type SegmentPageProps = {
  params: Promise<{
    segment: string;
  }>;
};

export function generateStaticParams() {
  return franceCampaignSegments.map((segment) => ({
    segment: segment.slug
  }));
}

export async function generateMetadata({ params }: SegmentPageProps): Promise<Metadata> {
  const { segment: slug } = await params;
  const segment = getFranceCampaignSegment(slug);
  if (!segment) {
    return {};
  }

  return {
    title: `${segment.title} | Logiciel gestion stock PME | LockStock`,
    description: segment.description
  };
}

export default async function FranceSegmentPage({ params }: SegmentPageProps) {
  const { segment: slug } = await params;
  const segment = getFranceCampaignSegment(slug);
  if (!segment) {
    notFound();
  }

  return (
    <FranceCampaignShell>
      <main className="france-campaign-main">
        <section className="france-hero france-segment-hero">
          <div className="landing-wrap france-hero-grid">
            <div>
              <p className="about-eyebrow">{segment.eyebrow}</p>
              <h1>{segment.title}: sortir d&apos;Excel sans deployer un ERP lourd</h1>
              <p className="france-hero-copy">{segment.description}</p>
              <div className="landing-hero-actions">
                <Link className="ghost-btn france-primary-link" href="/contact">
                  Demander une demo
                </Link>
                <Link className="ghost-btn" href="/france-pme/checklist-audit-stock">
                  Telecharger la checklist
                </Link>
              </div>
            </div>
            <aside className="france-command-board">
              <span>Mots-cles a tester</span>
              <ul className="france-keyword-list">
                {segment.searchTerms.map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-wrap france-two-column">
            <div>
              <p className="about-eyebrow">Problemes actuels</p>
              <h2>Pourquoi Excel bloque l&apos;equipe</h2>
              <div className="france-usecase-list">
                {segment.painPoints.map((painPoint) => (
                  <article key={painPoint}>
                    <h3>{painPoint}</h3>
                    <p>
                      LockStock transforme ce point faible en workflow partage: catalogue articles, emplacements, achats,
                      mouvements et historique restent dans le meme espace.
                    </p>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <p className="about-eyebrow">Resultats attendus</p>
              <h2>Ce que la page doit promettre</h2>
              <div className="france-outcome-panel">
                {segment.outcomes.map((outcome) => (
                  <article key={outcome}>
                    <span aria-hidden="true">+</span>
                    <p>{outcome}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <div className="landing-wrap landing-cta-card">
            <h2>Tester LockStock sur un petit perimetre suffit</h2>
            <p>
              Commencez avec 10 articles critiques, un emplacement, un fournisseur et une commande ouverte. En quelques
              minutes, l&apos;equipe voit si le workflow remplace son tableur actuel.
            </p>
            <div className="landing-cta-actions">
              <Link className="ghost-btn france-primary-link" href="/contact">
                Planifier une demo
              </Link>
              <Link className="ghost-btn" href="/pricing">
                Voir les tarifs
              </Link>
            </div>
          </div>
        </section>
      </main>
    </FranceCampaignShell>
  );
}
