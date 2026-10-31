// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const { locale } = vi.hoisted(() => ({ locale: { value: "en" as "en" | "fr" } }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/language-provider", () => ({ useLanguage: () => ({ locale: locale.value, setLocale: vi.fn() }) }));
import { AppSidebar } from "@/components/app-sidebar";

afterEach(() => { cleanup(); locale.value = "en"; window.localStorage.clear(); });
const routes = ["inventory", "materials", "stock-movements", "locations", "vendors", "purchase-orders", "replenishment", "members", "workflows"];
describe("shared app navigation", () => {
  it("groups routes and remembers logo collapse across page mounts", () => {
    const props = { pathname: "/inventory", signedIn: true, onSignOut: vi.fn() };
    const { unmount } = render(<AppSidebar {...props} />);
    for (const name of ["Stock", "Purchasing", "Workspace"]) expect(screen.getByRole("group", { name })).toBeInTheDocument();
    const logo = screen.getByRole("button", { name: "Collapse navigation" });
    expect(logo).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(logo);
    expect(screen.getByRole("button", { name: "Expand navigation" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Replenishment" })).toHaveAttribute("title", "Replenishment");
    expect(document.querySelector('.shell-nav')).toHaveAttribute("data-collapsed", "true");
    unmount();
    render(<AppSidebar {...props} pathname="/account" />);
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(document.querySelector('.shell-nav')).toHaveAttribute("data-collapsed", "false");
  });
  it("still collapses when preference storage is unavailable", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    render(<AppSidebar pathname="/account" signedIn onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeInTheDocument();
    storage.mockRestore();
  });
  it("keeps the language chooser reachable from icon-only mode", () => {
    render(<AppSidebar pathname="/account" signedIn onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation" }));
    const language = screen.getByRole("button", { name: "Language" });
    expect(language).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(language);
    expect(screen.getByRole("button", { name: "EN" })).toBeVisible();
    expect(screen.getByRole("button", { name: "FR" })).toBeVisible();
    expect(language).toHaveAttribute("aria-expanded", "true");
  });
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
