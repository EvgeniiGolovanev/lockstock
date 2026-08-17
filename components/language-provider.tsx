"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LANGUAGE_STORAGE_KEY, type Locale, normalizeLocale } from "@/lib/i18n";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
export function LanguageProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof document === "undefined") {
      return DEFAULT_LOCALE;
    }
    return normalizeLocale(document.documentElement.dataset.locale ?? document.documentElement.lang);
  });
  const [localeHydrated, setLocaleHydrated] = useState(false);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(normalizeLocale(nextLocale));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawSavedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const preloadedLocale = document.documentElement.dataset.locale;
    const savedLocale = normalizeLocale(rawSavedLocale);
    const detectedLocale = normalizeLocale(window.navigator.language);
    setLocaleState(rawSavedLocale ? savedLocale : preloadedLocale ? normalizeLocale(preloadedLocale) : detectedLocale);
    setLocaleHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !localeHydrated) {
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    document.documentElement.setAttribute("lang", locale);
  }, [locale, localeHydrated]);

  const value = useMemo(
    () => ({
      locale,
      setLocale
    }),
    [locale, setLocale]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider.");
  }
  return context;
}
