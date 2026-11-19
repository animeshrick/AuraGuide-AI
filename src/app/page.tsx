"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { HouseholdProfileSchema } from "@/ai/schemas";
import { Footer } from "@/components/Footer";
import { HouseholdForm } from "@/components/HouseholdForm";
import { Navbar } from "@/components/Navbar";
import { PlanResults } from "@/components/PlanResults";
import { StatusBanner } from "@/components/StatusBanner";
import { CARD } from "@/components/styles";
import { DailyPlanResponse, HouseholdProfile } from "@/domain/types";
import { getDictionary, isSupportedLanguage, SupportedLanguage } from "@/i18n";
import { ApiClientError, ClientErrorCode, requestPlan } from "@/lib/api-client";

const PROFILE_KEY = "auraguide:profile";
const LANGUAGE_KEY = "auraguide:language";

/** Session storage can be blocked or full. The app works the same without it. */
function safeStorage(action: () => void) {
  try {
    action();
  } catch {
    // Ignore.
  }
}

export default function HomePage() {
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [plan, setPlan] = useState<DailyPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [formKey, setFormKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const languageRef = useRef<SupportedLanguage>("en");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const focusResultsRef = useRef(false);

  const dict = getDictionary(language);

  // Restore the last household and language for this browser tab, after the page has loaded.
  useEffect(() => {
    safeStorage(() => {
      const storedLanguage = sessionStorage.getItem(LANGUAGE_KEY);
      if (isSupportedLanguage(storedLanguage)) {
        languageRef.current = storedLanguage;
        setLanguage(storedLanguage);
      }
      const raw = sessionStorage.getItem(PROFILE_KEY);
      if (raw) {
        const parsed = HouseholdProfileSchema.safeParse(JSON.parse(raw));
        if (parsed.success) {
          setProfile(parsed.data);
          setFormKey((k) => k + 1);
        }
      }
    });
  }, []);

  // Keep the page language in step with the chosen language, for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (plan && focusResultsRef.current) {
      focusResultsRef.current = false;
      headingRef.current?.focus();
      window.scrollTo({ top: 0 });
    }
  }, [plan]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = useCallback(
    async (target: HouseholdProfile, lang: SupportedLanguage, mode: "submit" | "language") => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      if (mode === "submit") setIsLoading(true);
      else setIsUpdatingLanguage(true);

      try {
        const result = await requestPlan({ ...target, language: lang }, controller.signal);
        if (controller.signal.aborted) return;
        if (mode === "submit") focusResultsRef.current = true;
        setPlan(result);
        // The language was switched while this request was running, so write the plan again.
        if (languageRef.current !== lang) {
          void generate(target, languageRef.current, "language");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiClientError ? err.code : "internal_error");
      } finally {
        if (abortRef.current === controller) {
          setIsLoading(false);
          setIsUpdatingLanguage(false);
        }
      }
    },
    []
  );

  const handleSubmit = (submitted: HouseholdProfile) => {
    const next = { ...submitted, language };
    setProfile(next);
    safeStorage(() => sessionStorage.setItem(PROFILE_KEY, JSON.stringify(next)));
    void generate(next, language, "submit");
  };

  const handleLanguageChange = (next: SupportedLanguage) => {
    if (next === language) return;
    languageRef.current = next;
    setLanguage(next);
    safeStorage(() => sessionStorage.setItem(LANGUAGE_KEY, next));
    if (profile && plan) void generate(profile, next, "language");
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setPlan(null);
    setError(null);
    setIsLoading(false);
    setIsUpdatingLanguage(false);
    // Remount the form so it starts from the household that was just used.
    setFormKey((k) => k + 1);
    mainRef.current?.focus();
  };

  return (
    <>
      <Navbar
        currentLanguage={language}
        onLanguageChange={handleLanguageChange}
        onReset={handleReset}
        hasPlan={plan !== null}
      />

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="flex-1 outline-none"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
          {error && (
            <StatusBanner
              tone="error"
              title={dict.errors.title}
              onDismiss={() => setError(null)}
              dismissLabel={dict.errors.dismiss}
            >
              {dict.errors[error]}
            </StatusBanner>
          )}

          {plan && profile ? (
            <PlanResults
              plan={plan}
              profile={profile}
              language={language}
              dict={dict}
              isUpdating={isUpdatingLanguage}
              headingRef={headingRef}
            />
          ) : (
            <>
              <div className="space-y-6">
                <div className="space-y-3 max-w-3xl">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                    {dict.hero.title}
                  </h1>
                  <p className="text-base sm:text-lg text-slate-800 leading-relaxed">
                    {dict.hero.body}
                  </p>
                </div>

                <section aria-label={dict.hero.stepsLabel} className={CARD}>
                  <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-900">
                    {[dict.hero.step1, dict.hero.step2, dict.hero.step3].map((step, i) => (
                      <li key={step} className="flex items-start gap-3">
                        <span
                          className="shrink-0 w-7 h-7 rounded-full bg-sky-700 text-white text-sm font-bold flex items-center justify-center"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <span className="pt-0.5 font-medium">{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <HouseholdForm
                key={formKey}
                language={language}
                onSubmit={handleSubmit}
                isLoading={isLoading}
                initialProfile={profile}
              />
            </>
          )}
        </div>
      </main>

      <Footer dict={dict} />

      <p role="status" className="sr-only">
        {isLoading ? dict.a11y.loading : ""}
      </p>
    </>
  );
}
