import { describe, expect, it } from "vitest";
import {
  franceCampaignChannels,
  franceCampaignCaseStudyTemplate,
  franceCampaignMetrics,
  franceCampaignSegments,
  franceCampaignSequences,
  franceComplianceRules,
  franceSeoUseCases,
  getFranceCampaignSegment
} from "@/lib/marketing/france";

describe("france-first marketing plan assets", () => {
  it("focuses on three French SME verticals", () => {
    expect(franceCampaignSegments).toHaveLength(3);
    expect(franceCampaignSegments.map((segment) => segment.slug)).toEqual([
      "construction-materiaux",
      "industrie-atelier",
      "maintenance-terrain"
    ]);
  });

  it("excludes TikTok from channel planning", () => {
    const channelText = franceCampaignChannels.map((channel) => `${channel.name} ${channel.plays.join(" ")}`).join(" ");

    expect(channelText.toLowerCase()).not.toContain("tiktok");
  });

  it("keeps French SEO use cases aligned to stock, purchasing, suppliers, and Excel replacement", () => {
    expect(franceSeoUseCases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "gestion-stock-pme" }),
        expect.objectContaining({ slug: "remplacer-excel-stock" }),
        expect.objectContaining({ slug: "gestion-commandes-fournisseurs" })
      ])
    );
  });

  it("defines role-relevant outbound and nurture sequences with opt-out language", () => {
    expect(franceCampaignSequences).toHaveLength(4);
    expect(franceCampaignSequences.map((sequence) => sequence.slug)).toEqual([
      "prospection-b2b",
      "nurture-essai",
      "relance-demo",
      "reactivation-essai"
    ]);

    const outbound = franceCampaignSequences.find((sequence) => sequence.slug === "prospection-b2b");
    expect(outbound?.steps.some((step) => step.body.includes("desinscription"))).toBe(true);
  });

  it("tracks the full measurement funnel", () => {
    expect(franceCampaignMetrics).toEqual([
      "visites",
      "essais",
      "demandes_demo",
      "leads_qualifies",
      "activation",
      "conversion_payante",
      "cac_estime"
    ]);
  });

  it("provides a case-study template before formal customer stories exist", () => {
    expect(franceCampaignCaseStudyTemplate.map((section) => section.label)).toEqual([
      "Probleme",
      "Ancien workflow",
      "Workflow LockStock",
      "Resultat mesurable"
    ]);
  });

  it("documents CNIL/GDPR guardrails for paid and outbound channels", () => {
    expect(franceComplianceRules).toEqual(
      expect.arrayContaining([
        expect.stringContaining("consentement"),
        expect.stringContaining("desinscription"),
        expect.stringContaining("suppression")
      ])
    );
  });

  it("finds a segment by slug", () => {
    expect(getFranceCampaignSegment("maintenance-terrain")?.title).toBe("Maintenance et interventions terrain");
    expect(getFranceCampaignSegment("unknown")).toBeUndefined();
  });
});
