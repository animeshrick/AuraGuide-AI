import { useCallback, useEffect, useState } from "react";
import type { DailyPlanResponse, HouseholdProfile } from "@/domain/types";
import type { SupportedLanguage } from "@/i18n";
import type { ClientErrorCode } from "@/lib/api-client";
import { ApiClientError, requestPlan } from "@/lib/api-client";
import { sessionStore } from "./sessionStore";
import { useLanguage } from "./useLanguage";
import { useLatestRequest } from "./useLatestRequest";

type RequestMode = "submit" | "language";

/** What `useStoredHousehold` returns. */
interface StoredHousehold {
  profile: HouseholdProfile | null;
  formKey: number;
  save: (next: HouseholdProfile) => void;
  remountForm: () => void;
}

/** What `usePlanSession` returns: everything the page reads and every action it can take. */
export interface PlanSession {
  language: SupportedLanguage;
  profile: HouseholdProfile | null;
  plan: DailyPlanResponse | null;
  isLoading: boolean;
  isUpdatingLanguage: boolean;
  error: ClientErrorCode | null;
  formKey: number;
  /** Goes up by one each time a submitted plan arrives, so the page can move focus to it. */
  planArrived: number;
  submit: (submitted: HouseholdProfile) => void;
  changeLanguage: (next: SupportedLanguage) => void;
  reset: () => void;
  clearError: () => void;
}

/**
 * The submitted household, restored for this browser tab after the page loads.
 * `formKey` changes to remount the form so it starts from the current household.
 */
function useStoredHousehold(): StoredHousehold {
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    const stored = sessionStore.readProfile();
    if (!stored) return;
    setProfile(stored);
    setFormKey((k) => k + 1);
  }, []);

  return {
    profile,
    formKey,
    save: (next: HouseholdProfile) => {
      setProfile(next);
      sessionStore.saveProfile(next);
    },
    remountForm: () => setFormKey((k) => k + 1),
  };
}

/**
 * The page's state: language, household, plan, loading flags and errors.
 * Submitting asks for a plan; switching language asks for the same plan in
 * the new language. Only the newest request may change the screen.
 */
export function usePlanSession(): PlanSession {
  const { language, latest: latestLanguage, choose: chooseLanguage } = useLanguage();
  const [plan, setPlan] = useState<DailyPlanResponse | null>(null);
  const [busy, setBusy] = useState<RequestMode | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const household = useStoredHousehold();
  const [planArrived, setPlanArrived] = useState(0);
  const request = useLatestRequest();

  const generate = useCallback(
    async (target: HouseholdProfile, lang: SupportedLanguage, mode: RequestMode): Promise<void> => {
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
    profile: household.profile,
    plan,
    isLoading: busy === "submit",
    isUpdatingLanguage: busy === "language",
    error,
    formKey: household.formKey,
    planArrived,
    submit: (submitted: HouseholdProfile) => {
      const next = { ...submitted, language };
      household.save(next);
      void generate(next, language, "submit");
    },
    changeLanguage: (next: SupportedLanguage) => {
      if (next === language) return;
      chooseLanguage(next);
      if (household.profile && plan) void generate(household.profile, next, "language");
    },
    reset: () => {
      request.cancel();
      setPlan(null);
      setError(null);
      setBusy(null);
      household.remountForm();
    },
    clearError: () => setError(null),
  };
}
