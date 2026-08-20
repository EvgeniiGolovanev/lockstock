import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";

export const metadata: Metadata = { title: "Terms of Service | LockStock", description: "LockStock terms of service." };

export default function TermsPage() {
  return (
    <LegalDocumentPage title="Terms of Service" alternateHref="/privacy" alternateLabel="Privacy Policy">
      <p>LockStock is an inventory operations service for organizations managing materials, locations, suppliers, purchase orders, and stock movements.</p>
      <h2>Before public launch</h2>
      <p>This route is live, but the complete production terms must be approved and published with the legal entity, commercial terms, taxes, refund policy, support commitments, governing law, and contact details configured for the actual service.</p>
      <p>The canonical pre-launch terms draft is maintained in <code>docs/terms-of-service.md</code>. Do not enable paid self-service until its required facts are completed and this page is updated to the approved final text.</p>
    </LegalDocumentPage>
  );
}
