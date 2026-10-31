"use client";

import Link from "next/link";
import type { Route } from "next";
import { useLayoutEffect, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { NavItemIcon, type NavIcon } from "@/components/nav-item-icon";
import { message, type StaticMessageKey } from "@/lib/i18n";
import styles from "./app-sidebar.module.css";

const NAV_ITEMS: ReadonlyArray<{ href: Route; labelKey: StaticMessageKey; icon: NavIcon }> = [
  { href: "/inventory", labelKey: "workbench.nav.inventory", icon: "inventory" },
  { href: "/materials", labelKey: "workbench.nav.materials", icon: "materials" },
  { href: "/stock-movements", labelKey: "workbench.nav.movements", icon: "stock-movements" },
  { href: "/locations", labelKey: "workbench.nav.locations", icon: "locations" },
  { href: "/vendors", labelKey: "workbench.nav.vendors", icon: "vendors" },
  { href: "/purchase-orders", labelKey: "workbench.nav.orders", icon: "purchase-orders" },
  { href: "/replenishment", labelKey: "workbench.nav.replenishment", icon: "purchase-orders" },
  { href: "/members", labelKey: "workbench.nav.members", icon: "members" },
  { href: "/workflows", labelKey: "workbench.nav.workflows", icon: "workflows" }
];

type AppSidebarProps = {
  pathname: string;
  signedIn: boolean;
  isPlatformAdmin?: boolean;
  busy?: boolean;
  onSignOut: () => void | Promise<void>;
};

export function AppSidebar({ pathname, signedIn, isPlatformAdmin = false, busy = false, onSignOut }: AppSidebarProps) {
  const { locale } = useLanguage();
  const navigation = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const copy = locale === "fr"
    ? { groups: ["Stock", "Achats", "Espace de travail"], collapse: "Réduire la navigation", expand: "Développer la navigation", language: "Langue" }
    : { groups: ["Stock", "Purchasing", "Workspace"], collapse: "Collapse navigation", expand: "Expand navigation", language: "Language" };
  useLayoutEffect(() => {
    try { setCollapsed(window.localStorage.getItem("lockstock.sidebar.collapsed") === "true"); } catch { /* Keep navigation usable without storage. */ }
  }, []);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    setLanguageOpen(false);
    try { window.localStorage.setItem("lockstock.sidebar.collapsed", String(next)); } catch { /* The current page can still collapse. */ }
  }
  useLayoutEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const revealActive = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return;
      const item = active.getBoundingClientRect();
      const viewport = nav.getBoundingClientRect();
      const top = viewport.top + nav.clientTop;
      const left = viewport.left + nav.clientLeft;
      if (item.top < top) nav.scrollTop += item.top - top;
      else if (item.bottom > top + nav.clientHeight) nav.scrollTop += item.bottom - top - nav.clientHeight;
      if (item.left < left) nav.scrollLeft += item.left - left;
      else if (item.right > left + nav.clientWidth) nav.scrollLeft += item.right - left - nav.clientWidth;
    };
    revealActive();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(revealActive);
    observer?.observe(nav);
    return () => observer?.disconnect();
  }, [pathname, locale, signedIn, isPlatformAdmin, collapsed]);
  const t = (key: StaticMessageKey) => message(locale, key);
  const activeProps = (href: string) => ({
    className: `nav-link${pathname === href ? " nav-link-active" : ""}`,
    "aria-current": pathname === href ? "page" as const : undefined
  });

  return (
    <section className={`card shell-nav ${styles.sidebar}`} data-collapsed={collapsed}>
      <div className={`shell-top ${styles.shell}`}>
        <button type="button" className={styles.brand} onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? copy.expand : copy.collapse} title={collapsed ? copy.expand : copy.collapse}>
          <svg className="brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
            <rect x="2" y="4" width="60" height="8" />
            <rect className="brand-mark-accent" x="2" y="16" width="60" height="8" />
            <rect x="2" y="28" width="60" height="8" />
          </svg>
          <span className={styles.label}>LockStock</span>
        </button>
        <nav ref={navigation} className={`nav-links ${styles.navigation}`} aria-label="LockStock">
          {[NAV_ITEMS.slice(0, 4), NAV_ITEMS.slice(4, 7), NAV_ITEMS.slice(7)].map((items, index) => (
            <div className={styles.group} role="group" aria-label={copy.groups[index]} key={index}>
              <div className={styles.groupTitle} aria-hidden="true">{copy.groups[index]}</div>
              {items.map(item => (
                <Link key={item.href} href={item.href} {...activeProps(item.href)} aria-label={t(item.labelKey)} title={t(item.labelKey)}>
                  <span className="nav-icon" aria-hidden="true"><NavItemIcon icon={item.icon} /></span>
                  <span className={styles.label}>{t(item.labelKey)}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className={`shell-user-actions ${styles.utilities}`}>
          {signedIn ? <>
            {isPlatformAdmin ? <Link href="/platform" {...activeProps("/platform")} aria-label={t("workbench.nav.platform")} title={t("workbench.nav.platform")}><span className="nav-icon" aria-hidden="true"><NavItemIcon icon="workflows" /></span><span className={styles.label}>{t("workbench.nav.platform")}</span></Link> : null}
            <Link href="/account" {...activeProps("/account")} aria-label={t("workbench.nav.account")} title={t("workbench.nav.account")}><span className="nav-icon" aria-hidden="true"><NavItemIcon icon="vendors" /></span><span className={styles.label}>{t("workbench.nav.account")}</span></Link>
          </> : <Link href="/" className="nav-link" aria-label={t("workbench.auth.signIn")} title={t("workbench.auth.signIn")}><span className="nav-icon" aria-hidden="true"><NavItemIcon icon="vendors" /></span><span className={styles.label}>{t("workbench.auth.signIn")}</span></Link>}
          <div className={styles.utilityRow}>
            {collapsed ? <button type="button" className={styles.languageToggle} onClick={() => setLanguageOpen(!languageOpen)} aria-label={copy.language} title={copy.language} aria-expanded={languageOpen}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"/></svg></button> : <LanguageSwitcher />}
            {signedIn ? <button type="button" className={styles.signOut} disabled={busy} onClick={() => void onSignOut()} aria-label={t("workbench.auth.signOut")} title={t("workbench.auth.signOut")}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4"/></svg><span className={styles.label}>{t("workbench.auth.signOut")}</span></button> : null}
          </div>
          {collapsed && languageOpen ? <div className={styles.languagePanel}><LanguageSwitcher /></div> : null}
        </div>
      </div>
    </section>
  );
}
