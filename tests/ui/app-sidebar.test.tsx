// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const { locale } = vi.hoisted(() => ({ locale: { value: "en" as "en" | "fr" } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: locale.value, setLocale: vi.fn() }) }));
import { AppSidebar } from "@/components/app-sidebar";

afterEach(() => { cleanup(); locale.value = "en"; });
const routes = ["inventory", "materials", "stock-movements", "locations", "vendors", "purchase-orders", "replenishment", "members", "workflows"];
describe("shared app navigation", () => {
  it.each([...routes, "account", "platform", "payment"])("keeps every section available from /%s", route => {
    render(<AppSidebar pathname={`/${route}`} signedIn isPlatformAdmin={route === "platform"} onSignOut={vi.fn()} />);
    const nav = screen.getByRole("navigation", { name: "LockStock" });
    for (const destination of routes) expect(nav.querySelector(`a[href="/${destination}"]`)).toBeInTheDocument();
    const current = document.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(route === "payment" ? 0 : 1);
    if (current.length) expect(current[0]).toHaveAttribute("href", `/${route}`);
  });
  it("shows platform access only for an authorized administrator", () => {
    const { rerender } = render(<AppSidebar pathname="/account" signedIn onSignOut={vi.fn()} />);
    expect(document.querySelector('a[href="/platform"]')).toBeNull();
    rerender(<AppSidebar pathname="/account" signedIn isPlatformAdmin onSignOut={vi.fn()} />);
    expect(document.querySelector('a[href="/platform"]')).toBeInTheDocument();
    rerender(<AppSidebar pathname="/inventory" signedIn={false} isPlatformAdmin onSignOut={vi.fn()} />);
    expect(document.querySelector('a[href="/platform"]')).toBeNull();
    expect(document.querySelector('a[href="/account"]')).toBeNull();
  });
  it("uses the current language and preserves the sign-out handler and busy state", () => {
    locale.value = "fr";
    const logout = vi.fn();
    const { rerender } = render(<AppSidebar pathname="/replenishment" signedIn onSignOut={logout} />);
    expect(document.querySelector('a[href="/replenishment"]')).toHaveAttribute("aria-label", "Réapprovisionnement");
    const button = screen.getByRole("button", { name: "Se deconnecter" });
    fireEvent.click(button); expect(logout).toHaveBeenCalledOnce();
    rerender(<AppSidebar pathname="/replenishment" signedIn busy onSignOut={logout} />);
    expect(button).toBeDisabled();
  });
});
