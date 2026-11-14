import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";
import Link from "next/link";
import { TranslatedMessage } from "@/components/translated-message";

export const metadata: Metadata = { title: "Terms of Service | LockStock", description: "LockStock terms of service." };

export default function TermsPage() {
  return (
    <LegalDocumentPage title={<TranslatedMessage id="legal.terms.title" />} alternateHref="/privacy" alternateLabel={<TranslatedMessage id="legal.privacy.title" />}>
      <p><TranslatedMessage id="legal.terms.summary" /></p>
      <h2><TranslatedMessage id="legal.pending.title" /></h2>
      <p><TranslatedMessage id="legal.terms.pending" /></p>
      <p><Link href="/contact"><TranslatedMessage id="legal.terms.contact" /></Link></p>
    </LegalDocumentPage>
  );
}
