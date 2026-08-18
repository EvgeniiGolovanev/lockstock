// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LanguageProvider } from "@/components/language-provider";
import { LocalizedDiv } from "@/components/localized-div";
import { TranslatedMessage } from "@/components/translated-message";
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";

describe("TranslatedMessage", () => {
  it("can render a stable message key from a server-component boundary", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");

    render(
      <LanguageProvider>
        <h1>
          <TranslatedMessage id="contact.company" />
        </h1>
      </LanguageProvider>
    );

    expect(await screen.findByRole("heading", { name: "Entreprise" })).toBeInTheDocument();
  });

  it("renders a translated accessible label without an extra layout wrapper", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");

    render(
      <LanguageProvider>
        <LocalizedDiv className="about-industry-grid" labelKey="about.teamExpertise">Content</LocalizedDiv>
      </LanguageProvider>
    );

    expect(await screen.findByLabelText("Expertise de l'equipe")).toHaveClass("about-industry-grid");
  });
});
