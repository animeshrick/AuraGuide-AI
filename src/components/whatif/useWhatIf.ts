import { useState } from "react";
import { LIMITS } from "@/domain/limits";
import type { CommuteMode, HouseholdProfile } from "@/domain/types";
import { isAbortError, useLatestRequest } from "@/hooks/useLatestRequest";
import type { SupportedLanguage } from "@/i18n";
import type { ClientErrorCode, WhatIfResult } from "@/lib/api-client";
import { ApiClientError, requestWhatIf } from "@/lib/api-client";

/** What `useWhatIf` returns. */
export interface WhatIfState {
  loading: boolean;
  result: WhatIfResult | null;
  error: ClientErrorCode | null;
  ask: (text: string, memberId: string, toMode?: CommuteMode) => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

/**
 * Sends what-if questions and keeps only the latest answer. A new question
 * cancels the one still in flight, so an old answer never replaces a newer one.
 */
export function useWhatIf(profile: HouseholdProfile, language: SupportedLanguage): WhatIfState {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const request = useLatestRequest();

  const ask = async (text: string, memberId: string, toMode?: CommuteMode): Promise<void> => {
    const trimmed = text.trim();
    if (trimmed.length < LIMITS.questionMinLength) return;

    const controller = request.start();
    setLoading(true);
    setError(null);
    try {
      const answer = await requestWhatIf(
        { profile, question: trimmed, memberId: memberId || undefined, toMode, language },
        controller.signal
      );
      setResult(answer);
    } catch (err) {
      if (isAbortError(err)) return;
      setResult(null);
      setError(err instanceof ApiClientError ? err.code : "internal_error");
    } finally {
      if (request.isLatest(controller)) setLoading(false);
    }
  };

  /** Cancel any question in flight and clear the answer, for example when the member changes. */
  const reset = () => {
    request.cancel();
    setLoading(false);
    setResult(null);
    setError(null);
  };

  return { loading, result, error, ask, reset, clearError: () => setError(null) };
}
