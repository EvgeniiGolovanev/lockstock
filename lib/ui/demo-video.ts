import type { Locale } from "@/lib/i18n";

export function demoVideoHref(locale: Locale) {
  return locale === "fr" ? "/lockstock-demo-fr.mp4" : "/lockstock-demo.mp4";
}
