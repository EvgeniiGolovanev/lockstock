import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";

export const metadata: Metadata = { title: "Privacy Policy | LockStock", description: "LockStock privacy policy." };

export default function PrivacyPage() {
  return (
    <LegalDocumentPage title="Privacy Policy" alternateHref="/terms" alternateLabel="Terms of Service">
      <p>LockStock processes account, workspace, inventory, invitation, billing, and support data only to provide and secure the service.</p>
      <h2>Before public launch</h2>
      <p>This route is live, but the complete production policy must be approved and published with the legal entity, contact details, processors, retention periods, cookie choices, and rights-request process configured for the actual service.</p>
      <p>The canonical pre-launch policy draft is maintained in <code>docs/privacy-policy.md</code>. Do not enable paid self-service until its required facts are completed and this page is updated to the approved final text.</p>
    </LegalDocumentPage>
  );
}
