// @vitest-environment jsdom

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { authMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn()
  }
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}));

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "fr", setLocale: vi.fn() })
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />
}));

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: authMock })
}));

vi.mock("@/lib/ui/demo-video", () => ({
  demoVideoHref: () => "/demo.mp4"
}));

import { LockstockLanding } from "@/components/lockstock-landing";

describe("LockstockLanding localization", () => {
  beforeEach(() => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("renders the marketing and auth entry copy from the French locale at render time", async () => {
    render(<LockstockLanding />);

    expect(await screen.findByRole("heading", { name: /Maitrisez votre inventaire/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Demarrer l'essai gratuit" })).toHaveLength(2);
    expect(screen.getByText("Aucune carte bancaire requise")).toBeInTheDocument();
  });
});
