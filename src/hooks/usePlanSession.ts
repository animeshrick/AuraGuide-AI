import { useCallback, useEffect, useRef, useState } from "react";
import { HouseholdProfileSchema } from "@/ai/schemas";
import type { DailyPlanResponse, HouseholdProfile } from "@/domain/types";
import { isSupportedLanguage, SupportedLanguage } from "@/i18n";
import { ApiClientError, ClientErrorCode, requestPlan } from "@/lib/api-client";
import { useLatestRequest } from "./useLatestRequest";

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

/** Read the household and language saved in this browser tab, if any. */
function restoreSession(): { language?: SupportedLanguage; profile?: HouseholdProfile } {
  const restored: { language?: SupportedLanguage; profile?: HouseholdProfile } = {};
  safeStorage(() => {
    const storedLanguage = sessionStorage.getItem(LANGUAGE_KEY);
    if (isSupportedLanguage(storedLanguage)) restored.language = storedLanguage;
    const raw = sessionStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = HouseholdProfileSchema.safeParse(JSON.parse(raw));
      if (parsed.success) restored.profile = parsed.data;
    }
  });
  return restored;
}

type RequestMode = "submit" | "language";

/**
 * The page's state: language, household, plan, loading flags and errors.
 * Submitting asks for a plan; switching language asks for the same plan in
 * the new language. Only the newest request may change the screen.
 */
export function usePlanSession() {
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [plan, setPlan] = useState<DailyPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  // Changing the key remounts the form so it starts from the current household.
  const [formKey, setFormKey] = useState(0);
  const [planArrived, setPlanArrived] = useState(0);

  const request = useLatestRequest();
  const languageRef = useRef<SupportedLanguage>("en");

  // Restore the last household and language for this browser tab, after the page has loaded.
  useEffect(() => {
    const restored = restoreSession();
    if (restored.language) {
      languageRef.current = restored.language;
      setLanguage(restored.language);
    }
    if (restored.profile) {
      setProfile(restored.profile);
      setFormKey((k) => k + 1);
    }
  }, []);

  // Keep the page language in step with the chosen language, for screen readers and hyphenation.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const generate = useCallback(
    async (target: HouseholdProfile, lang: SupportedLanguage, mode: RequestMode) => {
      const controller = request.start();
      setError(null);
      if (mode === "submit") setIsLoading(true);
      else setIsUpdatingLanguage(true);

      try {
        const result = await requestPlan({ ...target, language: lang }, controller.signal);
        if (controller.signal.aborted) return;
        setPlan(result);
        if (mode === "submit") setPlanArrived((n) => n + 1);
        // The language was switched while this request was running, so write the plan again.
        if (languageRef.current !== lang) {
          void generate(target, languageRef.current, "language");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiClientError ? err.code : "internal_error");
      } finally {
        if (request.isLatest(controller)) {
          setIsLoading(false);
          setIsUpdatingLanguage(false);
        }
      }
    },
    [request]
  );

  const submit = (submitted: HouseholdProfile) => {
    const next = { ...submitted, language };
    setProfile(next);
    safeStorage(() => sessionStorage.setItem(PROFILE_KEY, JSON.stringify(next)));
    void generate(next, language, "submit");
  };

  const changeLanguage = (next: SupportedLanguage) => {
    if (next === language) return;
    languageRef.current = next;
    setLanguage(next);
    safeStorage(() => sessionStorage.setItem(LANGUAGE_KEY, next));
    if (profile && plan) void generate(profile, next, "language");
  };

  const reset = () => {
    request.cancel();
    setPlan(null);
    setError(null);
    setIsLoading(false);
    setIsUpdatingLanguage(false);
    setFormKey((k) => k + 1);
  };

  return {
    language,
    profile,
    plan,
    isLoading,
    isUpdatingLanguage,
    error,
    formKey,
    /** Goes up by one each time a submitted plan arrives, so the page can move focus to it. */
    planArrived,
    submit,
    changeLanguage,
    reset,
    clearError: () => setError(null),
  };
}
