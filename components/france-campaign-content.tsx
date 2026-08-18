"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";
import styles from "./france-campaign.module.css";

type SegmentCard = {
  slug: string;
  eyebrow: StaticMessageKey;
  title: StaticMessageKey;
  description: StaticMessageKey;
  outcomes: readonly StaticMessageKey[];
  cta: StaticMessageKey;
};

const segmentCards: readonly SegmentCard[] = [
  { slug: "construction-materiaux", eyebrow: "france.card.construction.eyebrow", title: "france.card.construction.title", description: "france.card.construction.description", outcomes: ["france.card.construction.outcomeOne", "france.card.construction.outcomeTwo", "france.card.construction.outcomeThree"], cta: "france.card.construction.cta" },
  { slug: "industrie-atelier", eyebrow: "france.card.industry.eyebrow", title: "france.card.industry.title", description: "france.card.industry.description", outcomes: ["france.card.industry.outcomeOne", "france.card.industry.outcomeTwo", "france.card.industry.outcomeThree"], cta: "france.card.industry.cta" },
  { slug: "maintenance-terrain", eyebrow: "france.card.maintenance.eyebrow", title: "france.card.maintenance.title", description: "france.card.maintenance.description", outcomes: ["france.card.maintenance.outcomeOne", "france.card.maintenance.outcomeTwo", "france.card.maintenance.outcomeThree"], cta: "france.card.maintenance.cta" }
];

const useCaseCards: readonly { slug: string; title: StaticMessageKey; description: StaticMessageKey }[] = [
  { slug: "gestion-stock-pme", title: "france.useCase.stock.title", description: "france.useCase.stock.description" },
  { slug: "remplacer-excel-stock", title: "france.useCase.excel.title", description: "france.useCase.excel.description" },
  { slug: "gestion-commandes-fournisseurs", title: "france.useCase.purchase.title", description: "france.useCase.purchase.description" },
  { slug: "inventaire-multi-sites", title: "france.useCase.multisite.title", description: "france.useCase.multisite.description" }
];

type SegmentDetails = Omit<SegmentCard, "cta"> & { keywords: readonly StaticMessageKey[]; painPoints: readonly StaticMessageKey[] };

const segmentDetails: Record<string, SegmentDetails> = {
  "construction-materiaux": { ...segmentCards[0], keywords: ["france.detail.construction.keywordOne", "france.detail.construction.keywordTwo", "france.detail.construction.keywordThree"], painPoints: ["france.detail.construction.painOne", "france.detail.construction.painTwo", "france.detail.construction.painThree"] },
  "industrie-atelier": { ...segmentCards[1], keywords: ["france.detail.industry.keywordOne", "france.detail.industry.keywordTwo", "france.detail.industry.keywordThree"], painPoints: ["france.detail.industry.painOne", "france.detail.industry.painTwo", "france.detail.industry.painThree"] },
  "maintenance-terrain": { ...segmentCards[2], keywords: ["france.detail.maintenance.keywordOne", "france.detail.maintenance.keywordTwo", "france.detail.maintenance.keywordThree"], painPoints: ["france.detail.maintenance.painOne", "france.detail.maintenance.painTwo", "france.detail.maintenance.painThree"] }
};

export function FranceSegmentCards() {
  const { locale } = useLanguage();

  return segmentCards.map((segment) => (
    <article key={segment.slug} className={styles.segmentCard}>
      <p className={styles.eyebrow}>{message(locale, segment.eyebrow)}</p>
      <h3>{message(locale, segment.title)}</h3>
      <p>{message(locale, segment.description)}</p>
      <ul>{segment.outcomes.map((outcome) => <li key={outcome}>{message(locale, outcome)}</li>)}</ul>
      <Link className="ghost-btn" href={`/france-pme/${segment.slug}`}>{message(locale, segment.cta)}</Link>
    </article>
  ));
}

export function FranceUseCaseCards() {
  const { locale } = useLanguage();

  return useCaseCards.map((useCase) => (
    <article key={useCase.slug}>
      <h3>{message(locale, useCase.title)}</h3>
      <p>{message(locale, useCase.description)}</p>
      <small>{message(locale, "france.home.useCaseLabel")}</small>
    </article>
  ));
}

export function FranceSegmentDetails({ slug }: Readonly<{ slug: string }>) {
  const { locale } = useLanguage();
  const segment = segmentDetails[slug];
  if (!segment) return null;

  return <>
    <section className={styles.hero}><div className={`landing-wrap ${styles.heroGrid}`}><div>
      <p className={styles.eyebrow}>{message(locale, segment.eyebrow)}</p>
      <h1>{message(locale, segment.title)}: {message(locale, "france.segment.titleSuffix")}</h1>
      <p className={styles.heroCopy}>{message(locale, segment.description)}</p>
      <div className="landing-hero-actions"><Link className={`ghost-btn ${styles.primaryLink}`} href="/contact">{message(locale, "france.requestDemo")}</Link><Link className="ghost-btn" href="/france-pme/checklist-audit-stock">{message(locale, "france.segment.downloadChecklist")}</Link></div>
    </div><aside className={styles.commandBoard}><span>{message(locale, "france.segment.keywords")}</span><ul className={styles.keywordList}>{segment.keywords.map((keyword) => <li key={keyword}>{message(locale, keyword)}</li>)}</ul></aside></div></section>
    <section className="landing-section"><div className={`landing-wrap ${styles.twoColumn}`}><div>
      <p className={styles.eyebrow}>{message(locale, "france.segment.currentProblems")}</p><h2>{message(locale, "france.segment.excelProblem")}</h2><div className={styles.usecaseList}>{segment.painPoints.map((painPoint) => <article key={painPoint}><h3>{message(locale, painPoint)}</h3><p>{message(locale, "france.segment.workflowExplanation")}</p></article>)}</div>
    </div><div><p className={styles.eyebrow}>{message(locale, "france.segment.outcomes")}</p><h2>{message(locale, "france.segment.promise")}</h2><div className={styles.outcomePanel}>{segment.outcomes.map((outcome) => <article key={outcome}><span aria-hidden="true">+</span><p>{message(locale, outcome)}</p></article>)}</div></div></div></section>
    <section className="landing-cta"><div className="landing-wrap landing-cta-card"><h2>{message(locale, "france.segment.ctaTitle")}</h2><p>{message(locale, "france.segment.ctaDescription")}</p><div className="landing-cta-actions"><Link className={`ghost-btn ${styles.primaryLink}`} href="/contact">{message(locale, "france.segment.scheduleDemo")}</Link><Link className="ghost-btn" href="/pricing">{message(locale, "france.segment.viewPricing")}</Link></div></div></section>
  </>;
}
