import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentPage } from "@/components/legal-document-page";

export const metadata: Metadata = {
  title: "Security | LockStock",
  description: "How to report a suspected LockStock security vulnerability."
};

export default function SecurityPage() {
  return (
    <LegalDocumentPage title="Security" alternateHref="/privacy" alternateLabel="Privacy Policy">
      <p>
        If you believe you have found a security issue in LockStock, report it
        through the contact form and include “Security report” in the message.
      </p>
      <p>
        Do not include production credentials, payment card data, or personal
        data that is not needed to explain the issue.
      </p>
      <p>
        <Link href="/contact">Contact LockStock</Link>
      </p>
      <p>
        Read the <Link href="/privacy">Privacy Policy</Link> and{" "}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalDocumentPage>
  );
}
