import React, { useId } from "react";
import { Leaf } from "lucide-react";
import { EmissionImpact } from "@/domain/types";
import { Dictionary, formatMessage } from "@/i18n";
import { formatKg } from "@/lib/format";
import { SectionHeader } from "./SectionHeader";
import { CARD, MUTED } from "./styles";

interface EmissionsPanelProps {
  impact: EmissionImpact;
  dict: Dictionary;
}

/** Commute emissions today, before and after the suggested travel changes. */
export const EmissionsPanel: React.FC<EmissionsPanelProps> = ({ impact, dict }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <SectionHeader
        id={headingId}
        icon={Leaf}
        iconColor="text-teal-700"
        title={dict.results.emissionsHeading}
      />

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <dt className="text-xs font-semibold text-slate-700">{dict.results.emissionsBaseline}</dt>
          <dd className="mt-1 font-mono font-bold text-slate-900">
            {formatMessage(dict.results.kgPerDay, { kg: formatKg(impact.baselineEmissionsKg) })}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <dt className="text-xs font-semibold text-slate-700">
            {dict.results.emissionsOptimized}
          </dt>
          <dd className="mt-1 font-mono font-bold text-slate-900">
            {formatMessage(dict.results.kgPerDay, { kg: formatKg(impact.optimizedEmissionsKg) })}
          </dd>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3">
          <dt className="text-xs font-semibold text-emerald-900">
            {dict.results.emissionsSavedLabel}
          </dt>
          <dd className="mt-1 font-mono font-bold text-emerald-950">
            {formatMessage(dict.results.kgPerDay, { kg: formatKg(impact.savedEmissionsKg) })}
          </dd>
        </div>
      </dl>

      {impact.modeSwaps.length === 0 ? (
        <p className={MUTED}>{dict.results.noModeSwaps}</p>
      ) : (
        <ul className="space-y-1.5 text-sm text-slate-800">
          {impact.modeSwaps.map((swap, i) => (
            <li key={`${swap.from}-${swap.to}-${i}`} className="list-disc ml-5">
              {formatMessage(dict.results.modeSwap, {
                from: dict.modes[swap.from],
                to: dict.modes[swap.to],
                kg: formatKg(swap.savedKg),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
