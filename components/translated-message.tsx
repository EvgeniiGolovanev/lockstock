"use client";

import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";

/** Renders a stable message key in a Server Component-compatible client leaf. */
export function TranslatedMessage({ id }: Readonly<{ id: StaticMessageKey }>) {
  const { locale } = useLanguage();
  return message(locale, id);
}
