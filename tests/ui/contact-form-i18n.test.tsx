// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "@/components/contact-form";
import { LanguageProvider } from "@/components/language-provider";
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";

describe("ContactForm localization", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders labels and the submit action from render-time messages", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    render(
      <LanguageProvider>
        <ContactForm />
      </LanguageProvider>
    );

    expect(await screen.findByRole("button", { name: "Envoyer le message" })).toBeInTheDocument();
    expect(screen.getByText("Entreprise")).toBeInTheDocument();
  });

  it("renders known contact API errors through French message keys", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Contact email delivery is not configured." })
    }));

    render(
      <LanguageProvider>
        <ContactForm />
      </LanguageProvider>
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Nom" }), { target: { value: "Marie" } });
    fireEvent.change(screen.getByRole("textbox", { name: "E-mail" }), { target: { value: "marie@example.com" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Bonjour" } });
    fireEvent.click(await screen.findByRole("button", { name: "Envoyer le message" }));

    expect(await screen.findByText("L'envoi des emails de contact n'est pas configure.")).toBeInTheDocument();
  });
});
