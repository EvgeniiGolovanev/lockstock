import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, localeLabel, message, normalizeLocale } from "@/lib/i18n";

describe("i18n helpers", () => {
  it("normalizes locale values and falls back to default", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(normalizeLocale("fr")).toBe("fr");
    expect(normalizeLocale("FR-fr")).toBe("fr");
    expect(normalizeLocale("en-US")).toBe("en");
    expect(normalizeLocale("de")).toBe("en");
  });

  it("returns user-facing locale labels", () => {
    expect(localeLabel("en")).toBe("English");
    expect(localeLabel("fr")).toBe("Francais");
  });

  it("renders stable message keys with typed interpolation", () => {
    expect(message("fr", "catalog.location.created")).toBe("Emplacement cree.");
    expect(message("fr", "catalog.location.usage.unblockConfirm", { name: "Depot Nord" })).toBe("Autoriser Depot Nord pour les nouvelles utilisations ?");
    expect(message("en", "workbench.auth.activeMembership", { name: "North warehouse", role: "manager" })).toBe("Active workspace: North warehouse (manager)");
  });

  it("fails clearly when a runtime message key is missing", () => {
    expect(() => message("en", "missing.key" as never)).toThrow('Missing i18n message key: "missing.key".');
  });
});