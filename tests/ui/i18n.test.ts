import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, localeLabel, normalizeLocale, translateText } from "@/lib/i18n";

describe("i18n helpers", () => {
  it("normalizes locale values and falls back to default", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(normalizeLocale("fr")).toBe("fr");
    expect(normalizeLocale("FR-fr")).toBe("fr");
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("de")).toBe("en");
    expect(normalizeLocale("")).toBe("en");
  });

  it("returns user-facing locale labels", () => {
    expect(localeLabel("en")).toBe("English");
    expect(localeLabel("fr")).toBe("Francais");
  });

  it("translates known static phrases", () => {
    expect(translateText("Sign In", "fr")).toBe("Se connecter");
    expect(translateText("Purchase Orders", "fr")).toBe("Commandes d'achat");
    expect(translateText("No activity yet.", "fr")).toBe("Aucune activite pour le moment.");
    expect(translateText("Sign In", "en")).toBe("Sign In");
  });

  it("translates dynamic strings used in the interface", () => {
    expect(translateText("Page 2 / 8 (50 total)", "fr")).toBe("Page 2 / 8 (50 au total)");
    expect(translateText("3 item(s) - EUR 120.00", "fr")).toBe("3 article(s) - EUR 120.00");
    expect(translateText("5 stars", "fr")).toBe("5 etoiles");
    expect(translateText("10:45:11 - Signed out.", "fr")).toBe("10:45:11 - Deconnecte.");
  });

  it("keeps unknown text unchanged", () => {
    expect(translateText("Custom supplier name", "fr")).toBe("Custom supplier name");
  });
});
