"use client";

import type { ReactNode } from "react";

import { useLanguage } from "@/components/language-provider";
import { message, type StaticMessageKey } from "@/lib/i18n";

/** A render-time localized label for an existing div, without changing its layout. */
export function LocalizedDiv({
  labelKey,
  className,
  children
}: Readonly<{
  labelKey: StaticMessageKey;
  className?: string;
  children: ReactNode;
}>) {
  const { locale } = useLanguage();
  return <div className={className} aria-label={message(locale, labelKey)}>{children}</div>;
}
