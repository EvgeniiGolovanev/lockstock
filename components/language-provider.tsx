"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_LOCALE, LANGUAGE_STORAGE_KEY, type Locale, normalizeLocale, translateText } from "@/lib/i18n";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "aria-label", "title", "alt"] as const;
type TranslationState = {
  source: string;
  applied: string;
};

function isIgnoredTextNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) {
    return true;
  }

  if (parent.closest("[data-locale-ignore='true']")) {
    return true;
  }

  return ["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"].includes(parent.tagName);
}

export function LanguageProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const textStatesRef = useRef(new WeakMap<Text, TranslationState>());
  const attributeStatesRef = useRef(new WeakMap<Element, Map<string, TranslationState>>());

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(normalizeLocale(nextLocale));
  }, []);

  const translateDom = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.body;
    if (!root) {
      return;
    }

    const textWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let textNode = textWalker.nextNode() as Text | null;
    while (textNode) {
      if (!isIgnoredTextNode(textNode)) {
        const currentText = textNode.textContent ?? "";
        let state = textStatesRef.current.get(textNode);
        if (!state) {
          state = {
            source: currentText,
            applied: currentText
          };
          textStatesRef.current.set(textNode, state);
        } else if (currentText !== state.applied) {
          // React or user input updated this node; treat it as new source text.
          state.source = currentText;
        }

        const translated = translateText(state.source, locale);
        if (currentText !== translated) {
          textNode.textContent = translated;
        }
        state.applied = translated;
      }
      textNode = textWalker.nextNode() as Text | null;
    }

    const elements = root.querySelectorAll<HTMLElement>("*");
    elements.forEach((element) => {
      if (element.closest("[data-locale-ignore='true']")) {
        return;
      }

      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        if (!element.hasAttribute(attribute)) {
          continue;
        }

        const currentValue = element.getAttribute(attribute) ?? "";
        let attributeMap = attributeStatesRef.current.get(element);
        if (!attributeMap) {
          attributeMap = new Map<string, TranslationState>();
          attributeStatesRef.current.set(element, attributeMap);
        }

        let state = attributeMap.get(attribute);
        if (!state) {
          state = {
            source: currentValue,
            applied: currentValue
          };
          attributeMap.set(attribute, state);
        } else if (currentValue !== state.applied) {
          state.source = currentValue;
        }

        const translated = translateText(state.source, locale);
        if (currentValue !== translated) {
          element.setAttribute(attribute, translated);
        }
        state.applied = translated;
      }
    });
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawSavedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    const savedLocale = normalizeLocale(rawSavedLocale);
    const detectedLocale = normalizeLocale(window.navigator.language);
    setLocaleState(rawSavedLocale ? savedLocale : detectedLocale);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    document.documentElement.setAttribute("lang", locale);
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    translateDom();

    let frameId: number | null = null;
    const observer = new MutationObserver(() => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        translateDom();
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });

    return () => {
      observer.disconnect();
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [translateDom]);

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
