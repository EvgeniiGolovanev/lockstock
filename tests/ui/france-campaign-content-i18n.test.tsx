import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const language = { locale: "en" as "en" | "fr" };

vi.mock("@/components/language-provider", () => ({
  useLanguage: () => ({ locale: language.locale, setLocale: vi.fn() })
}));

import { FranceSegmentCards, FranceSegmentDetails, FranceUseCaseCards } from "@/components/france-campaign-content";

describe("France campaign render-time content", () => {
  it("renders segment cards in English from stable message keys", () => {
    language.locale = "en";
    render(<FranceSegmentCards />);

    expect(screen.getByRole("heading", { name: "Construction and materials" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See LockStock for construction" })).toHaveAttribute("href", "/france-pme/construction-materiaux");
    expect(screen.queryByText("Construction et materiaux")).not.toBeInTheDocument();
  });

  it("updates SEO use-case cards to French without post-render DOM translation", () => {
    language.locale = "fr";
    render(<FranceUseCaseCards />);

    expect(screen.getByRole("heading", { name: "Gestion de stock pour PME" })).toBeInTheDocument();
    expect(screen.getByText("Une page pilier pour les dirigeants et responsables operations qui cherchent une alternative simple a l'ERP.")).toBeInTheDocument();
  });

  it("renders a vertical page's dynamic content in English", () => {
    language.locale = "en";
    const { container } = render(<FranceSegmentDetails slug="maintenance-terrain" />);
    const view = within(container);

    expect(view.getByText("Parts, vehicles, sites")).toBeInTheDocument();
    expect(view.getByRole("heading", { name: /Field maintenance and service/ })).toBeInTheDocument();
    expect(view.getByText("Record consumption, transfers, and adjustments")).toBeInTheDocument();
  });
});
