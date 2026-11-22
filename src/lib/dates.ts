import type { SupportedLanguage } from "@/i18n";

const LOCALES: Record<SupportedLanguage, string> = { en: "en-IN", hi: "hi-IN", bn: "bn-IN" };

/**
 * A local date such as "2026-11-23" as "Monday, 23 Nov" in the page language.
 * The date is read as UTC so the weekday never shifts with the viewer's time zone.
 */
export function formatDayLabel(date: string, language: SupportedLanguage): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(LOCALES[language], {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parsed);
}
