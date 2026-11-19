"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { MessageCircleQuestion, Send } from "lucide-react";
import { HouseholdProfile } from "@/domain/types";
import { Dictionary, formatMessage, SupportedLanguage } from "@/i18n";
import {
  ApiClientError,
  ClientErrorCode,
  requestWhatIf,
  WhatIfResult,
} from "@/lib/api-client";
import { formatKg } from "@/lib/format";
import { StatusBanner } from "./StatusBanner";
import { CARD, MUTED, SECTION_HEADING } from "./styles";

interface WhatIfPanelProps {
  profile: HouseholdProfile;
  language: SupportedLanguage;
  dict: Dictionary;
}

export const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ profile, language, dict }) => {
  const uid = useId();
  const [memberId, setMemberId] = useState(profile.members[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const answer = await requestWhatIf(
        { profile, question: trimmed, memberId: memberId || undefined, language },
        controller.signal
      );
      setResult(answer);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResult(null);
      setError(err instanceof ApiClientError ? err.code : "internal_error");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const examples = [dict.whatIf.example1, dict.whatIf.example2, dict.whatIf.example3];

  return (
    <section aria-labelledby={`${uid}-h`} className={`${CARD} space-y-5`}>
      <div>
        <h2 id={`${uid}-h`} className={SECTION_HEADING}>
          <MessageCircleQuestion className="w-5 h-5 text-sky-700" aria-hidden="true" />
          {dict.sections.whatIfTitle}
        </h2>
        <p className={`${MUTED} mt-1`}>{dict.whatIf.intro}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor={`${uid}-who`} className="block text-xs font-medium text-slate-800 mb-1">
              {dict.whatIf.who}
            </label>
            <select
              id={`${uid}-who`}
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
            >
              {profile.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`${uid}-q`} className="block text-xs font-medium text-slate-800 mb-1">
              {dict.whatIf.question}
            </label>
            <input
              id={`${uid}-q`}
              type="text"
              required
              minLength={3}
              maxLength={300}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={dict.whatIf.placeholder}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-700">{dict.whatIf.examplesLabel}:</span>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              disabled={loading}
              onClick={() => {
                setQuestion(example);
                void ask(example);
              }}
              className="text-xs px-2.5 py-1 rounded-full border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-60"
            >
              {example}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold disabled:opacity-60"
        >
          <Send className="w-4 h-4" aria-hidden="true" />
          {loading ? dict.whatIf.asking : dict.whatIf.ask}
        </button>
      </form>

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

      <div aria-live="polite" aria-atomic="true">
        {result && !result.matched && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            {formatMessage(dict.whatIf.unmatched[result.reason], { name: result.memberName })}
          </p>
        )}

        {result && result.matched && <WhatIfAnswer result={result} dict={dict} />}
      </div>
    </section>
  );
};

const WhatIfAnswer: React.FC<{
  result: Extract<WhatIfResult, { matched: true }>;
  dict: Dictionary;
}> = ({ result, dict }) => {
  const exposurePct = Math.round(result.exposureChangePercentage);
  const exposureLine =
    exposurePct === 0
      ? dict.whatIf.exposureSame
      : exposurePct < 0
        ? formatMessage(dict.whatIf.exposureLower, { pct: Math.abs(exposurePct) })
        : formatMessage(dict.whatIf.exposureHigher, { pct: exposurePct });

  const saved = result.savedEmissionsKg;
  const savedLine =
    saved >= 0
      ? formatMessage(dict.whatIf.savedLine, { kg: formatKg(saved) })
      : formatMessage(dict.whatIf.extraLine, { kg: formatKg(Math.abs(saved)) });

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 space-y-3">
      <h3 className="font-bold text-slate-900">
        {formatMessage(dict.whatIf.result, { name: result.memberName })}
      </h3>
      <p className="text-sm font-semibold text-slate-900">
        {formatMessage(dict.whatIf.change, {
          from: dict.modes[result.fromMode],
          to: dict.modes[result.toMode],
        })}
      </p>
      <ul className="list-disc pl-5 space-y-1 text-sm text-slate-900">
        <li>
          {formatMessage(dict.whatIf.emissionsLine, {
            before: formatKg(result.householdBaselineEmissionsKg),
            after: formatKg(result.householdRecalculatedEmissionsKg),
          })}
        </li>
        <li>{savedLine}</li>
        <li>{exposureLine}</li>
      </ul>
      <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-line">
        {result.explanation}
      </p>
      <p className="text-xs text-slate-700">
        {result.explanationSource === "gemini" ? dict.whatIf.viaGemini : dict.whatIf.viaRules}
        {". "}
        {dict.whatIf.numbersNote}
      </p>
    </div>
  );
};
