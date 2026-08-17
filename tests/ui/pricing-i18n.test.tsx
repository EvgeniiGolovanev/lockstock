import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: "fr", setLocale: vi.fn() })
}));

vi.mock("@/components/language-switcher", () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />
}));

import PricingPage from "@/app/pricing/page";

describe("PricingPage localization", () => {
  it("renders public pricing copy from French render-time message keys", () => {
    render(<PricingPage />);

    expect(screen.getByRole("heading", { name: "Offres pour piloter les stocks et les achats avec contrôle" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Limites par offre" })).toBeInTheDocument();
    expect(screen.getByText("Recommandée")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Conditions d'utilisation" })).toBeInTheDocument();
  });
});
