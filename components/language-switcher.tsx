"use client";

import { useLanguage } from "@/components/language-provider";
import { message } from "@/lib/i18n";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const languageLabel = message(locale, "language.label");

  return (
    <div className="locale-switcher" aria-label={languageLabel}>
      <div className="locale-switcher-actions">
        <button
          type="button"
          className={`locale-switcher-btn ${locale === "en" ? "locale-switcher-btn-active" : ""}`}
          onClick={() => setLocale("en")}
        >
          EN
        </button>
        <button
          type="button"
          className={`locale-switcher-btn ${locale === "fr" ? "locale-switcher-btn-active" : ""}`}
          onClick={() => setLocale("fr")}
        >
          FR
        </button>
      </div>
    </div>
  );
}
