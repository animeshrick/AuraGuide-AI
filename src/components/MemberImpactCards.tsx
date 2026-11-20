import React, { useId } from "react";
import { Users } from "lucide-react";
import { MemberExposureImpact } from "@/domain/types";
import { Dictionary, formatMessage } from "@/i18n";
import { formatDose } from "@/lib/format";
import { CARD, SECTION_HEADING } from "./styles";

interface MemberImpactCardsProps {
  impacts: MemberExposureImpact[];
  dict: Dictionary;
}

export const MemberImpactCards: React.FC<MemberImpactCardsProps> = ({ impacts, dict }) => {
  const headingId = useId();
  if (impacts.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <h2 id={headingId} className={SECTION_HEADING}>
        <Users className="w-5 h-5 text-sky-700" aria-hidden="true" />
        {dict.results.memberHeading}
      </h2>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {impacts.map((m) => {
          const pct = Math.max(0, Math.min(100, Math.round(m.exposureAvoidedPercentage)));
          return (
            <li
              key={m.memberId}
              className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-bold text-slate-900 break-words">{m.memberName}</h3>
                <p className="text-sm font-bold text-emerald-900 whitespace-nowrap">
                  {formatMessage(dict.results.avoidedPct, { pct })}
                </p>
              </div>

              <div className="h-2 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
              </div>

              <p className="text-xs text-slate-700">
                {dict.results.exposureIndex}:{" "}
                <span className="font-mono font-semibold text-slate-900">
                  {formatMessage(dict.results.exposureBeforeAfter, {
                    before: formatDose(m.baselineExposureDose),
                    after: formatDose(m.optimizedExposureDose),
                  })}
                </span>
              </p>

              {m.keyChanges.length > 0 && (
                <ul className="list-disc pl-5 space-y-1 text-sm text-slate-800">
                  {m.keyChanges.map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
