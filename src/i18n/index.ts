import bn from "./bn.json";
import en from "./en.json";
import hi from "./hi.json";

export type SupportedLanguage = "en" | "hi" | "bn";

/** English is the source of truth. Hindi and Bengali must have exactly the same keys, or the build fails. */
export type Dictionary = typeof en;

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ["en", "hi", "bn"];

export const dictionaries: Record<SupportedLanguage, Dictionary> = {
  en,
  hi,
  bn,
};

/** True when the value is a language the app supports. */
export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === "string" && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** The text for a language, falling back to English. */
export function getDictionary(lang: SupportedLanguage = "en"): Dictionary {
  return dictionaries[lang] ?? dictionaries.en;
}

/** Fill `{name}` style placeholders. Unknown placeholders are left as written. */
export function formatMessage(
  template: string,
  values: Record<string, string | number> = {}
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  );
}
