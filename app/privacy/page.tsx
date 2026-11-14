import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";
import Link from "next/link";
import { TranslatedMessage } from "@/components/translated-message";

export const metadata: Metadata = { title: "Privacy Policy | LockStock", description: "LockStock privacy policy." };

export default function PrivacyPage() {
  return (
    <LegalDocumentPage title={<TranslatedMessage id="legal.privacy.title" />} alternateHref="/terms" alternateLabel={<TranslatedMessage id="legal.terms.title" />}>
      <p><TranslatedMessage id="legal.privacy.summary" /></p>
      <h2><TranslatedMessage id="legal.pending.title" /></h2>
      <p><TranslatedMessage id="legal.privacy.pending" /></p>
      <p><Link href="/contact"><TranslatedMessage id="legal.privacy.contact" /></Link></p>
    </LegalDocumentPage>
  );
}
