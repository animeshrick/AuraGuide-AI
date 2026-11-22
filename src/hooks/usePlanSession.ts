import { useCallback, useEffect, useState } from "react";
import type { DailyPlanResponse, HouseholdProfile } from "@/domain/types";
import type { SupportedLanguage } from "@/i18n";
import { ApiClientError, ClientErrorCode, requestPlan } from "@/lib/api-client";
import { sessionStore } from "./sessionStore";
import { useLanguage } from "./useLanguage";
import { useLatestRequest } from "./useLatestRequest";

type RequestMode = "submit" | "language";

/**
 * The page's state: language, household, plan, loading flags and errors.
 * Submitting asks for a plan; switching language asks for the same plan in
 * the new language. Only the newest request may change the screen.
 */
export function usePlanSession() {
  const { language, latest: latestLanguage, choose: chooseLanguage } = useLanguage();
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [plan, setPlan] = useState<DailyPlanResponse | null>(null);
  const [busy, setBusy] = useState<RequestMode | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  // Changing the key remounts the form so it starts from the current household.
  const [formKey, setFormKey] = useState(0);
  const [planArrived, setPlanArrived] = useState(0);
  const request = useLatestRequest();

  // Restore the last household for this browser tab, after the page has loaded.
  useEffect(() => {
    const stored = sessionStore.readProfile();
    if (!stored) return;
    setProfile(stored);
    setFormKey((k) => k + 1);
  }, []);

  const generate = useCallback(
    async (target: HouseholdProfile, lang: SupportedLanguage, mode: RequestMode) => {
      const controller = request.start();
      setError(null);
      setBusy(mode);
      try {
        const result = await requestPlan({ ...target, language: lang }, controller.signal);
        if (controller.signal.aborted) return;
        setPlan(result);
        if (mode === "submit") setPlanArrived((n) => n + 1);
        // The language was switched while this request was running, so write the plan again.
        if (latestLanguage.current !== lang) {
          void generate(target, latestLanguage.current, "language");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiClientError ? err.code : "internal_error");
      } finally {
        if (request.isLatest(controller)) setBusy(null);
      }
    },
    [request, latestLanguage]
  );

  return {
    language,
    profile,
    plan,
    isLoading: busy === "submit",
    isUpdatingLanguage: busy === "language",
    error,
    formKey,
    /** Goes up by one each time a submitted plan arrives, so the page can move focus to it. */
    planArrived,
    submit: (submitted: HouseholdProfile) => {
      const next = { ...submitted, language };
      setProfile(next);
      sessionStore.saveProfile(next);
      void generate(next, language, "submit");
    },
    changeLanguage: (next: SupportedLanguage) => {
      if (next === language) return;
      chooseLanguage(next);
      if (profile && plan) void generate(profile, next, "language");
    },
    reset: () => {
      request.cancel();
      setPlan(null);
      setError(null);
      setBusy(null);
      setFormKey((k) => k + 1);
    },
    clearError: () => setError(null),
  };
}
