import React, { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import type { Dictionary } from "@/i18n";
import { formatMessage } from "@/i18n";
import type { AdvisoryResult } from "@/lib/api-client";
import { SUB_CARD } from "../styles";

interface AdvisoryResultCardProps {
  result: AdvisoryResult;
  dict: Dictionary;
}

/** The written advisory, with copy and WhatsApp share buttons. */
export const AdvisoryResultCard: React.FC<AdvisoryResultCardProps> = ({ result, dict }) => {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.advisoryText);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className={SUB_CARD}>
      <h3 className="font-bold text-slate-900">
        {formatMessage(dict.advisory.resultFor, {
          audience: dict.advisory.audiences[result.audience],
        })}
      </h3>
      {/* Plain text only. The model's words are never rendered as HTML. */}
      <p className="whitespace-pre-line text-sm text-slate-900 leading-relaxed">
        {result.advisoryText}
      </p>
      <p className="text-xs text-slate-700">{dict.advisory.viaGemini}</p>

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
  );
};
