import React from "react";
import { OctagonAlert, ShieldAlert, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatHour } from "@/domain/labels";
import type { OutingAdvice, OutingLevel } from "@/domain/outing";
import { Dictionary, formatMessage } from "@/i18n";
import { AQIBadge } from "../AQIBadge";

/** Each level has a word, an icon and a colour, so colour is never the only signal. */
const LEVEL_LOOK: Record<OutingLevel, { Icon: LucideIcon; box: string; icon: string }> = {
  fine: {
    Icon: ShieldCheck,
    box: "border-emerald-300 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-700 text-white",
  },
  careful: {
    Icon: ShieldAlert,
    box: "border-amber-300 bg-amber-50 text-amber-950",
    icon: "bg-amber-700 text-white",
  },
  avoid: {
    Icon: OctagonAlert,
    box: "border-rose-300 bg-rose-50 text-rose-950",
    icon: "bg-rose-700 text-white",
  },
};

interface OutingAdviceViewProps {
  advice: OutingAdvice;
  memberName: string;
  time: string;
  dict: Dictionary;
}

/** The verdict for one trip out, a cleaner hour if there is one, and the steps to take. */
export const OutingAdviceView: React.FC<OutingAdviceViewProps> = ({
  advice,
  memberName,
  time,
  dict,
}) => {
  const t = dict.outing;
  const look = LEVEL_LOOK[advice.level];
  return (
    <>
      <div className={`rounded-2xl border-2 p-4 sm:p-5 flex items-start gap-4 ${look.box}`}>
        <span
          className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${look.icon}`}
        >
          <look.Icon className="w-6 h-6" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h3 className="text-xl font-bold leading-snug">
            {formatMessage(t.verdict[advice.level], { name: memberName, time })}
          </h3>
          <p className="text-base font-semibold">{t.levels[advice.level]}</p>
          <p className="flex flex-wrap items-center gap-2 text-base">
            {formatMessage(t.airAt, { time })}
            <AQIBadge
              aqi={advice.aqi}
              category={advice.category}
              categoryLabel={dict.categories[advice.category]}
              aqiLabel={dict.metrics.aqiLabel}
              size="lg"
            />
          </p>
          {advice.stricter && (
            <p className="text-sm">{formatMessage(t.stricter, { name: memberName })}</p>
          )}
        </div>
      </div>

      {advice.cleaner ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h4 className="text-base font-bold text-slate-900">{t.cleanerTitle}</h4>
          <p className="flex flex-wrap items-center gap-2 text-base text-slate-900 mt-1">
            {formatMessage(t.cleanerLine, { time: formatHour(advice.cleaner.hour) })}
            <AQIBadge
              aqi={advice.cleaner.aqi}
              category={advice.cleaner.category}
              categoryLabel={dict.categories[advice.cleaner.category]}
              aqiLabel={dict.metrics.aqiLabel}
              size="md"
            />
          </p>
        </div>
      ) : (
        advice.level !== "fine" && <p className="text-base text-slate-800">{t.noCleaner}</p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h4 className="text-base font-bold text-slate-900">{t.stepsTitle}</h4>
        {advice.precautions.length === 1 && (
          <p className="text-base text-slate-800 mt-1">{t.nothingSpecial}</p>
        )}
        <ol className="list-decimal pl-6 mt-2 space-y-2 text-base text-slate-900 leading-relaxed">
          {advice.precautions.map((id) => (
            <li key={id}>{t.steps[id]}</li>
          ))}
        </ol>
      </div>
    </>
  );
};
