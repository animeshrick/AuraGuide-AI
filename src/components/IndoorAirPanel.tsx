import React, { useId } from "react";
import { Home, AlertTriangle } from "lucide-react";
import { IndoorAirAdvice } from "@/domain/types";
import { Dictionary } from "@/i18n";
import { CARD, SECTION_HEADING } from "./styles";

interface IndoorAirPanelProps {
  advice: IndoorAirAdvice;
  dict: Dictionary;
}

/** Advice for cleaner air at home: cooking, airing, purifier use and hazards. */
export const IndoorAirPanel: React.FC<IndoorAirPanelProps> = ({ advice, dict }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <h2 id={headingId} className={SECTION_HEADING}>
        <Home className="w-5 h-5 text-sky-700" aria-hidden="true" />
        {dict.sections.indoorAir}
      </h2>

      <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(
          [
            [dict.results.cooking, advice.cookingAdvice],
            [dict.results.ventilation, advice.ventilationWindow],
            [dict.results.purifierPlan, advice.purifierStrategy],
          ] as const
        ).map(([term, text]) => (
          <div key={term} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-700">{term}</dt>
            <dd className="mt-1.5 text-sm text-slate-900 leading-relaxed">{text}</dd>
          </div>
        ))}
      </dl>

      {advice.hazardWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700" aria-hidden="true" />
            {dict.results.hazards}
          </h3>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-amber-950">
            {advice.hazardWarnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
