import { useEffect, useRef, useState } from "react";
import type { SupportedLanguage } from "@/i18n";
import { sessionStore } from "./sessionStore";

/**
 * The chosen language, restored for this tab after the page loads and kept in
 * the page's `lang` attribute. `latest` always holds the newest choice, so a
 * request that finishes later can tell whether the language changed meanwhile.
 */
export function useLanguage() {
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const latest = useRef<SupportedLanguage>("en");

  useEffect(() => {
    const stored = sessionStore.readLanguage();
    if (!stored) return;
    latest.current = stored;
    setLanguage(stored);
  }, []);

  // Screen readers and hyphenation follow the page's lang attribute.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const choose = (next: SupportedLanguage) => {
    latest.current = next;
    setLanguage(next);
    sessionStore.saveLanguage(next);
  };

  return { language, latest, choose };
}
