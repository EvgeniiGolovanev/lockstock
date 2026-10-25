"use client";

import Link from "next/link";
import type { Route } from "next";
import { useLayoutEffect, useRef } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useLanguage } from "@/components/language-provider";
import { NavItemIcon, type NavIcon } from "@/components/nav-item-icon";
import { message, type StaticMessageKey } from "@/lib/i18n";

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
  }, [pathname, locale, signedIn, isPlatformAdmin]);
  const t = (key: StaticMessageKey) => message(locale, key);
  const activeProps = (href: string) => ({
    className: `nav-link${pathname === href ? " nav-link-active" : ""}`,
    "aria-current": pathname === href ? "page" as const : undefined
  });

  return (
    <section className="card shell-nav">
      <div className="shell-top">
        <div className="brand-wrap">
          <svg className="brand-mark" viewBox="0 0 64 40" aria-hidden="true" focusable="false">
            <rect x="2" y="4" width="60" height="8" />
            <rect className="brand-mark-accent" x="2" y="16" width="60" height="8" />
            <rect x="2" y="28" width="60" height="8" />
          </svg>
          <h2>LockStock</h2>
        </div>
        <nav ref={navigation} className="nav-links" aria-label="LockStock">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} {...activeProps(item.href)} aria-label={t(item.labelKey)} title={t(item.labelKey)}>
              <span className="nav-icon" aria-hidden="true"><NavItemIcon icon={item.icon} /></span>
              <span>{t(item.labelKey)}</span>
            </Link>
          ))}
        </nav>
        <div className="shell-user-actions">
          {signedIn ? <>
            {isPlatformAdmin ? <Link href="/platform" {...activeProps("/platform")}>{t("workbench.nav.platform")}</Link> : null}
            <LanguageSwitcher />
            <Link href="/account" {...activeProps("/account")}>{t("workbench.nav.account")}</Link>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => void onSignOut()}>{t("workbench.auth.signOut")}</button>
          </> : <>
            <Link href="/" className="nav-link">{t("workbench.auth.signIn")}</Link>
            <LanguageSwitcher />
          </>}
        </div>
      </div>
    </section>
  );
}
