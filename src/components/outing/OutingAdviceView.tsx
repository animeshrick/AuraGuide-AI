import React from "react";
import { OctagonAlert, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatHour } from "@/domain/labels";
import type { OutingAdvice, OutingLevel } from "@/domain/outing";
import type { Dictionary } from "@/i18n";
import { formatMessage } from "@/i18n";
import { LocalizedAQIBadge } from "@/components/AQIBadge";
import { PANEL } from "@/components/styles";
import type { VerdictLook } from "@/components/VerdictCard";
import { VerdictCard } from "@/components/VerdictCard";

/** Each level has a word, an icon and a colour, so colour is never the only signal. */
const LEVEL_LOOK: Record<OutingLevel, VerdictLook> = {
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

/** A nearby hour with cleaner air, or a note that there is none. */
const CleanerHour: React.FC<{ advice: OutingAdvice; dict: Dictionary }> = ({ advice, dict }) => {
  const t = dict.outing;
  if (!advice.cleaner) {
    return advice.level === "fine" ? null : (
      <p className="text-base text-slate-800">{t.noCleaner}</p>
    );
  }
  return (
    <div className={PANEL}>
      <h4 className="text-base font-bold text-slate-900">{t.cleanerTitle}</h4>
      <p className="flex flex-wrap items-center gap-2 text-base text-slate-900 mt-1">
        {formatMessage(t.cleanerLine, { time: formatHour(advice.cleaner.hour) })}
        <LocalizedAQIBadge
          aqi={advice.cleaner.aqi}
          category={advice.cleaner.category}
          dict={dict}
          size="md"
        />
      </p>
    </div>
  );
};

/** The numbered steps to take. The last one, watching for symptoms, is always there. */
const PrecautionSteps: React.FC<{ advice: OutingAdvice; t: Dictionary["outing"] }> = ({
  advice,
  t,
}) => (
  <div className={PANEL}>
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
);

/** The verdict for one trip out, a cleaner hour if there is one, and the steps to take. */
export const OutingAdviceView: React.FC<OutingAdviceViewProps> = ({
  advice,
  memberName,
  time,
  dict,
}) => {
  const t = dict.outing;
  return (
    <>
      <VerdictCard look={LEVEL_LOOK[advice.level]}>
        <h3 className="text-xl font-bold leading-snug">
          {formatMessage(t.verdict[advice.level], { name: memberName, time })}
        </h3>
        <p className="text-base font-semibold">{t.levels[advice.level]}</p>
        <p className="flex flex-wrap items-center gap-2 text-base">
          {formatMessage(t.airAt, { time })}
          <LocalizedAQIBadge aqi={advice.aqi} category={advice.category} dict={dict} size="lg" />
        </p>
        {advice.stricter && (
          <p className="text-sm">{formatMessage(t.stricter, { name: memberName })}</p>
        )}
      </VerdictCard>
      <CleanerHour advice={advice} dict={dict} />
      <PrecautionSteps advice={advice} t={t} />
    </>
  );
};
