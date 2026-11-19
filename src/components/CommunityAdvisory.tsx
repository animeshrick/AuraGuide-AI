"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { Megaphone, Copy, Check, Share2 } from "lucide-react";
import { AdvisoryAudience } from "@/domain/advisory";
import { Dictionary, formatMessage, SupportedLanguage } from "@/i18n";
import {
  AdvisoryResult,
  ApiClientError,
  ClientErrorCode,
  requestAdvisory,
} from "@/lib/api-client";
import { StatusBanner } from "./StatusBanner";
import { CARD, MUTED, SECTION_HEADING } from "./styles";

interface CommunityAdvisoryProps {
  city: string;
  language: SupportedLanguage;
  dict: Dictionary;
}

const AUDIENCES: AdvisoryAudience[] = ["housing_society", "school", "general_public"];

export const CommunityAdvisory: React.FC<CommunityAdvisoryProps> = ({ city, language, dict }) => {
  const uid = useId();
  const [audience, setAudience] = useState<AdvisoryAudience>("housing_society");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisoryResult | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const generate = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setCopyState("idle");
    try {
      setResult(await requestAdvisory({ city, audience, language }, controller.signal));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setResult(null);
      setError(err instanceof ApiClientError ? err.code : "internal_error");
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.advisoryText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
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

      <fieldset>
        <legend className="text-xs font-medium text-slate-800 mb-2">{dict.advisory.audience}</legend>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <label
              key={a}
              className={`cursor-pointer text-sm px-3 py-1.5 rounded-lg border transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-700 ${
                audience === a
                  ? "bg-sky-700 text-white border-sky-700"
                  : "bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name={`${uid}-audience`}
                value={a}
                checked={audience === a}
                onChange={() => setAudience(a)}
                className="sr-only"
              />
              {dict.advisory.audiences[a]}
            </label>
          ))}
        </div>
      </fieldset>

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
        {result && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <h3 className="font-bold text-slate-900">
              {formatMessage(dict.advisory.resultFor, {
                audience: dict.advisory.audiences[result.audience],
              })}
            </h3>
            {/* Plain text only. The model's words are never rendered as HTML. */}
            <p className="whitespace-pre-line text-sm text-slate-900 leading-relaxed">
              {result.advisoryText}
            </p>
            <p className="text-xs text-slate-700">
              {result.advisorySource === "gemini"
                ? dict.advisory.viaGemini
                : dict.advisory.viaRules}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                {copyState === "copied" ? (
                  <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Copy className="w-4 h-4" aria-hidden="true" />
                )}
                {copyState === "copied" ? dict.advisory.copied : dict.advisory.copy}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(result.advisoryText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-400 bg-emerald-50 text-sm font-medium text-emerald-950 hover:bg-emerald-100"
              >
                <Share2 className="w-4 h-4" aria-hidden="true" />
                {dict.advisory.shareWhatsApp}
              </a>
            </div>
            {copyState === "failed" && (
              <p role="status" className="text-xs text-rose-800">
                {dict.advisory.copyFailed}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
