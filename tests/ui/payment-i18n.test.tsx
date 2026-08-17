// @vitest-environment jsdom

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { authMock } = vi.hoisted(() => ({
  authMock: { getSession: vi.fn(), onAuthStateChange: vi.fn() }
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>
}));

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "fr", setLocale: vi.fn() })
}));

vi.mock("@/lib/supabase-browser", () => ({
  getSupabaseBrowserClient: () => ({ auth: authMock })
}));

import { LockstockPayment } from "@/components/lockstock-payment";

describe("LockstockPayment localization", () => {
  beforeEach(() => {
    window.localStorage.setItem("lockstock.orgId", "org-1");
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: null }) }));
  });

  it("renders payment entry and authentication labels through French message keys", async () => {
    render(<LockstockPayment />);

    expect(await screen.findByRole("heading", { name: /Payez la capacite/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mensuel" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("E-mail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Se connecter" })).toBeInTheDocument();
  });
});
