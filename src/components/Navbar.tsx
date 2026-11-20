"use client";

import React from "react";
import { Wind, Globe, Sparkles } from "lucide-react";
import { getDictionary, SupportedLanguage } from "@/i18n";

interface NavbarProps {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  onReset?: () => void;
  hasPlan?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentLanguage,
  onLanguageChange,
  onReset,
  hasPlan,
}) => {
  const dict = getDictionary(currentLanguage);

  const languages = [
    { code: "en", short: "EN", label: dict.nav.switchToEnglish },
    { code: "hi", short: "हिंदी", label: dict.nav.switchToHindi },
    { code: "bn", short: "বাংলা", label: dict.nav.switchToBengali },
  ] as const;

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-sky-800 focus:shadow-lg"
      >
        {dict.nav.skipToContent}
      </a>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-700 to-teal-700 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
              <Wind className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">
                  {dict.appTitle}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-800 border border-sky-200">
                  <Sparkles className="w-3 h-3" aria-hidden="true" />
                  {dict.nav.badge}
                </span>
              </div>
              <p className="text-xs text-slate-600 hidden md:block">{dict.appTagline}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            {hasPlan && onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition"
              >
                {dict.nav.newProfile}
              </button>
            )}

            <div
              role="group"
              aria-label={dict.nav.languageGroup}
              className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium"
            >
              <Globe className="w-3.5 h-3.5 text-slate-600 ml-1 mr-0.5" aria-hidden="true" />
              {languages.map((lang) => {
                const selected = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    lang={lang.code}
                    onClick={() => onLanguageChange(lang.code)}
                    aria-pressed={selected}
                    aria-label={lang.label}
                    className={`px-2 py-1 rounded transition ${
                      selected
                        ? "bg-white text-sky-800 shadow-sm font-semibold"
                        : "text-slate-700 hover:text-slate-900"
                    }`}
                  >
                    {lang.short}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
