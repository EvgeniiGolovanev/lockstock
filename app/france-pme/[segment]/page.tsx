import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FranceCampaignShell } from "@/components/france-campaign-shell";
import { FranceSegmentDetails } from "@/components/france-campaign-content";
import { franceCampaignSegments, getFranceCampaignSegment } from "@/lib/marketing/france";
import styles from "@/components/france-campaign.module.css";

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
      <main className={styles.main}>
        <FranceSegmentDetails slug={segment.slug} />
      </main>
    </FranceCampaignShell>
  );
}
