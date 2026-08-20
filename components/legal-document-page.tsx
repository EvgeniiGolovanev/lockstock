import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import shellStyles from "@/components/marketing-shell.module.css";

type LegalDocumentPageProps = {
  title: string;
  children: React.ReactNode;
  alternateHref: "/privacy" | "/terms";
  alternateLabel: string;
};

export function LegalDocumentPage({ title, children, alternateHref, alternateLabel }: LegalDocumentPageProps) {
  return (
    <div className={shellStyles.scope}>
      <header className="landing-header">
        <div className="landing-wrap landing-header-row">
          <Link className="landing-brand" href="/">LockStock</Link>
          <div className="landing-actions"><LanguageSwitcher /><Link className="ghost-btn" href="/">Home</Link></div>
        </div>
      </header>
      <main className="landing-wrap" style={{ maxWidth: "900px", paddingBlock: "4rem" }}>
        <h1>{title}</h1>
        <p><Link href={alternateHref}>{alternateLabel}</Link></p>
        {children}
      </main>
      <footer className="landing-footer"><div className="landing-wrap landing-footer-bottom">© LockStock · <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link></div></footer>
    </div>
  );
}
