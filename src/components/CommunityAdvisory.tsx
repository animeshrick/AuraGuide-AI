"use client";

import React, { useId, useState } from "react";
import { Megaphone } from "lucide-react";
import type { AdvisoryAudience } from "@/domain/types";
import { isAbortError, useLatestRequest } from "@/hooks/useLatestRequest";
import type { Dictionary, SupportedLanguage } from "@/i18n";
import { AdvisoryResult, ApiClientError, ClientErrorCode, requestAdvisory } from "@/lib/api-client";
import { AdvisoryResultCard } from "./advisory/AdvisoryResultCard";
import { AudiencePicker } from "./advisory/AudiencePicker";
import { StatusBanner } from "./StatusBanner";
import { CARD, MUTED, SECTION_HEADING } from "./styles";

interface CommunityAdvisoryProps {
  city: string;
  language: SupportedLanguage;
  dict: Dictionary;
}

/** Writes a shareable air quality notice for a housing society, school or neighbourhood. */
export const CommunityAdvisory: React.FC<CommunityAdvisoryProps> = ({ city, language, dict }) => {
  const uid = useId();
  const [audience, setAudience] = useState<AdvisoryAudience>("housing_society");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisoryResult | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  // Counts finished requests, so each new advisory gets a fresh copy button.
  const [resultId, setResultId] = useState(0);
  const request = useLatestRequest();

  const generate = async () => {
    const controller = request.start();
    setLoading(true);
    setError(null);
    try {
      setResult(await requestAdvisory({ city, audience, language }, controller.signal));
      setResultId((n) => n + 1);
    } catch (err) {
      if (isAbortError(err)) return;
      setResult(null);
      setError(err instanceof ApiClientError ? err.code : "internal_error");
    } finally {
      if (request.isLatest(controller)) setLoading(false);
    }
  };

  return (
    <section aria-labelledby={`${uid}-h`} className={`${CARD} space-y-5`}>
      <div>
        <h2 id={`${uid}-h`} className={SECTION_HEADING}>
          <Megaphone className="w-5 h-5 text-sky-700" aria-hidden="true" />
          {dict.sections.communityAdvisory}
        </h2>
        <p className={`${MUTED} mt-1`}>{dict.advisory.intro}</p>
      </div>

      <AudiencePicker
        name={`${uid}-audience`}
        value={audience}
        dict={dict}
        onChange={setAudience}
      />

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold disabled:opacity-60"
      >
        <Megaphone className="w-4 h-4" aria-hidden="true" />
        {loading ? dict.advisory.generating : dict.advisory.generate}
      </button>

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

      <div aria-live="polite">
        {result && <AdvisoryResultCard key={resultId} result={result} dict={dict} />}
      </div>
    </section>
  );
};
