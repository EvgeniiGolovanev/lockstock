// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageProvider, useLanguage } from "@/components/language-provider";
import { LANGUAGE_STORAGE_KEY } from "@/lib/i18n";

function LocaleControls() {
  const { locale, setLocale } = useLanguage();

  return (
    <>
      <output>{locale}</output>
      <button type="button" onClick={() => setLocale("fr")}>
        Choose French
      </button>
    </>
  );
}

describe("LanguageProvider", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
    delete document.documentElement.dataset.locale;
  });

  it("persists a user-selected locale and updates the document language", async () => {
    const view = render(
      <LanguageProvider>
        <LocaleControls />
      </LanguageProvider>
    );

    view.getByRole("button", { name: "Choose French" }).click();

    expect(await screen.findByText("fr")).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("fr");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("fr");
  });

  it("restores a saved locale before it writes the default locale", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");

    render(
      <LanguageProvider>
        <LocaleControls />
      </LanguageProvider>
    );

    expect(await screen.findByText("fr")).toBeInTheDocument();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("fr");
  });

  it("does not observe or rewrite the application DOM", () => {
    const Observer = vi.fn();
    const originalObserver = window.MutationObserver;
    Object.defineProperty(window, "MutationObserver", { configurable: true, value: Observer });

    render(
      <LanguageProvider>
        <LocaleControls />
      </LanguageProvider>
    );

    expect(Observer).not.toHaveBeenCalled();
    Object.defineProperty(window, "MutationObserver", { configurable: true, value: originalObserver });
  });

});
