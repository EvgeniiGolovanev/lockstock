import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";

export function FranceCampaignHeader() {
  return (
    <header className="landing-header france-campaign-header">
      <div className="landing-wrap landing-header-row">
        <Link className="landing-brand about-brand-link" href="/france-pme">
          <svg className="landing-brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
            <rect x="2" y="4" width="60" height="8" />
            <rect className="landing-brand-mark-accent" x="2" y="16" width="60" height="8" />
            <rect x="2" y="28" width="60" height="8" />
          </svg>
          <span className="landing-brand-text">LockStock</span>
        </Link>
        <nav className="landing-nav">
          <Link href="/france-pme">PME France</Link>
          <Link href="/france-pme/construction-materiaux">Construction</Link>
          <Link href="/france-pme/industrie-atelier">Industrie</Link>
          <Link href="/france-pme/maintenance-terrain">Maintenance</Link>
        </nav>
        <div className="landing-actions">
          <LanguageSwitcher />
          <Link className="ghost-btn" href="/contact">
            Demander une demo
          </Link>
        </div>
      </div>
    </header>
  );
}

export function FranceCampaignFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-wrap landing-footer-grid landing-footer-grid-compact">
        <div>
          <div className="landing-brand">
            <svg className="landing-brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
              <rect x="2" y="4" width="60" height="8" />
              <rect className="landing-brand-mark-accent" x="2" y="16" width="60" height="8" />
              <rect x="2" y="28" width="60" height="8" />
            </svg>
            <span className="landing-brand-text">LockStock</span>
          </div>
          <p className="landing-footer-text">
            Gestion des stocks, achats, fournisseurs et emplacements pour PME qui veulent sortir d&apos;Excel.
          </p>
        </div>
        <div>
          <h4>France</h4>
          <Link href="/#features">Produit</Link>
          <Link href="/pricing">Tarifs</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/france-pme">PME France</Link>
        </div>
        <div>
          <h4>Ressources</h4>
          <Link href="/france-pme/checklist-audit-stock">Checklist audit stock</Link>
          <Link href="/france-pme/construction-materiaux">Stock construction</Link>
          <Link href="/workflows">Guides workflow</Link>
        </div>
      </div>
      <div className="landing-wrap landing-footer-bottom">(c) 2026 LockStock. Tous droits reserves.</div>
    </footer>
  );
}

export function FranceCampaignShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="landing-page france-campaign-page">
      <FranceCampaignHeader />
      {children}
      <FranceCampaignFooter />
    </div>
  );
}
