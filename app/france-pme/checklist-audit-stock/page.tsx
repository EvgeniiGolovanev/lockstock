import type { Metadata } from "next";
import Link from "next/link";
import { FranceCampaignShell } from "@/components/france-campaign-shell";

const checklistSections = [
  {
    title: "Donnees articles",
    items: [
      "Chaque article a un SKU stable, un nom clair, une unite et une categorie.",
      "Les seuils minimums sont renseignes pour les articles critiques.",
      "Les doublons, variantes mal nommees et anciennes references sont identifies."
    ]
  },
  {
    title: "Emplacements et quantites",
    items: [
      "Les stocks sont suivis par depot, chantier, zone, vehicule ou local technique.",
      "Les ecarts entre stock reel et stock fichier sont mesures au moins chaque semaine.",
      "Les transferts entre emplacements sont traces."
    ]
  },
  {
    title: "Achats et fournisseurs",
    items: [
      "Chaque fournisseur important a des coordonnees, delais et conditions a jour.",
      "Les commandes ouvertes sont visibles avant tout nouvel achat.",
      "Les receptions partielles modifient le stock sans perdre l'historique."
    ]
  },
  {
    title: "Roles, audit et pilotage",
    items: [
      "Les personnes peuvent seulement faire les actions utiles a leur role.",
      "Les mouvements sensibles gardent une trace exploitable.",
      "Les indicateurs suivis sont visites, essais, demandes demo, leads qualifies, activation, conversion payante et CAC estime."
    ]
  }
];

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
              <p className="about-eyebrow">Audit stock PME</p>
              <h1>Checklist audit stock PME: 20 points pour sortir d&apos;Excel</h1>
              <p className="france-hero-copy">
                Passez en revue les articles, emplacements, achats, fournisseurs, roles et controles qui rendent votre
                suivi de stock fiable au quotidien.
              </p>
              <div className="landing-hero-actions">
                <Link className="ghost-btn france-primary-link" href="/contact">
                  Recevoir la version accompagnee
                </Link>
                <Link className="ghost-btn" href="/france-pme">
                  Decouvrir LockStock pour les PME
                </Link>
              </div>
            </div>
            <aside className="france-command-board">
              <span>Resultat</span>
              <strong>Identifier les points faibles avant d&apos;investir dans un outil</strong>
              <p>
                Reperer les fichiers multiples, mouvements non traces, seuils absents et commandes difficiles a suivre.
              </p>
            </aside>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-wrap france-checklist-grid">
            {checklistSections.map((section, sectionIndex) => (
              <article key={section.title} className="france-checklist-card">
                <h2>{section.title}</h2>
                <ol start={sectionIndex * 5 + 1}>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  <li>Le responsable sait qui corrige ce point et sous quel delai.</li>
                  <li>Le point peut etre mesure dans un tableau de suivi hebdomadaire.</li>
                </ol>
              </article>
            ))}
          </div>
        </section>
      </main>
    </FranceCampaignShell>
  );
}
