"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLanguage();
  const languageLabel = locale === "fr" ? "Langue" : "Language";

  return (
    <div className="locale-switcher" data-locale-ignore="true" aria-label={languageLabel}>
      <span className="locale-switcher-label">{languageLabel}</span>
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
