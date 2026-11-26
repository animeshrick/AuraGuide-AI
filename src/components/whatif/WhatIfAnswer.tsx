import React from "react";
import { Cloud, Equal, Scale, ThumbsUp, TriangleAlert, Wind } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n";
import { formatMessage } from "@/i18n";
import type { WhatIfResult } from "@/lib/api-client";
import { formatKg } from "@/lib/format";
import { bySign } from "@/lib/by-sign";
import { NOTICE, PANEL } from "../styles";
import type { VerdictLook } from "../VerdictCard";
import { VerdictCard } from "../VerdictCard";
import type { WhatIfVerdict } from "@/lib/whatif-verdict";
import { barWidths, whatIfVerdict } from "@/lib/whatif-verdict";

/** Each verdict has a word, an icon and a colour, so colour is never the only signal. */
const VERDICT_LOOK: Record<WhatIfVerdict, VerdictLook & { bar: string }> = {
  better: {
    Icon: ThumbsUp,
    box: "border-emerald-300 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-700 text-white",
    bar: "bg-emerald-600",
  },
  mixed: {
    Icon: Scale,
    box: "border-amber-300 bg-amber-50 text-amber-950",
    icon: "bg-amber-700 text-white",
    bar: "bg-amber-600",
  },
  same: {
    Icon: Equal,
    box: "border-slate-300 bg-slate-50 text-slate-900",
    icon: "bg-slate-600 text-white",
    bar: "bg-slate-500",
  },
  worse: {
    Icon: TriangleAlert,
    box: "border-rose-300 bg-rose-50 text-rose-950",
    icon: "bg-rose-700 text-white",
    bar: "bg-rose-600",
  },
};

type MatchedResult = Extract<WhatIfResult, { matched: true }>;

/** Words, bar widths and colours for one result. Pure, so the view only lays them out. */
function describeChange(result: MatchedResult, t: Dictionary["whatIf"]) {
  const airPct = Math.round(result.exposureChangePercentage);
  const savedKg = Math.round(result.savedEmissionsKg * 100) / 100;
  const verdict = whatIfVerdict(result.exposureChangePercentage, result.savedEmissionsKg);

  // Less air breathed in is better, so the sign is flipped for the air headline.
  const airHeadline = bySign(-airPct, {
    positive: formatMessage(t.breathBetter, { pct: Math.abs(airPct) }),
    negative: formatMessage(t.breathWorse, { pct: airPct }),
    zero: t.breathSame,
  });
  const fumesHeadline = bySign(savedKg, {
    positive: formatMessage(t.fumesBetter, { kg: formatKg(savedKg) }),
    negative: formatMessage(t.fumesWorse, { kg: formatKg(Math.abs(savedKg)) }),
    zero: t.fumesSame,
  });

  return {
    verdict,
    airHeadline,
    fumesHeadline,
    // Less dirty air is a shorter bar, so a longer "after" bar is the worse result.
    airBars: barWidths(100, 100 + airPct),
    fumeBars: barWidths(
      result.householdBaselineEmissionsKg,
      result.householdRecalculatedEmissionsKg
    ),
    airTone: toneFor(-airPct),
    fumesTone: toneFor(savedKg),
  };
}

/** Bar colour for a change where a positive number is the better result. */
function toneFor(improvement: number): string {
  return bySign(improvement, {
    positive: VERDICT_LOOK.better.bar,
    negative: VERDICT_LOOK.worse.bar,
    zero: VERDICT_LOOK.same.bar,
  });
}

/** The one-line verdict with its icon, and the change that was tried. */
const VerdictBanner: React.FC<{
  result: MatchedResult;
  verdict: WhatIfVerdict;
  dict: Dictionary;
}> = ({ result, verdict, dict }) => {
  const t = dict.whatIf;
  return (
    <VerdictCard look={VERDICT_LOOK[verdict]}>
      <h3 className="text-xl font-bold leading-snug">
        {formatMessage(t.verdict[verdict], { name: result.memberName })}
      </h3>
      <p className="text-base">
        {formatMessage(t.changeLine, {
          from: t.modeShort[result.fromMode],
          to: t.modeShort[result.toMode],
        })}
      </p>
    </VerdictCard>
  );
};

/** Gemini's plain-words explanation, with a note that the numbers come from the engine. */
const ExplanationCard: React.FC<{ explanation: string; t: Dictionary["whatIf"] }> = ({
  explanation,
  t,
}) => (
  <div className={`${PANEL} space-y-2`}>
    <h4 className="text-base font-bold text-slate-900">{t.simpleWords}</h4>
    <p className="text-base text-slate-900 leading-relaxed whitespace-pre-line">{explanation}</p>
    <p className="text-sm text-slate-700">
      {t.viaGemini}
      {". "}
      {t.numbersNote}
    </p>
  </div>
);

/** One number that changes, in words first and as two bars second. */
const FactCard: React.FC<{
  icon: LucideIcon;
  title: string;
  headline: string;
  note: string;
  nowLabel: string;
  afterLabel: string;
  bars: { now: number; after: number };
  tone: string;
  nowText?: string;
  afterText?: string;
}> = ({
  icon: Icon,
  title,
  headline,
  note,
  nowLabel,
  afterLabel,
  bars,
  tone,
  nowText,
  afterText,
}) => (
  <div className={PANEL}>
    <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
      <Icon className="w-5 h-5 text-sky-700 shrink-0" aria-hidden="true" />
      {title}
    </p>
    <p className="text-2xl font-bold text-slate-900 mt-2">{headline}</p>
    <p className="text-sm text-slate-700 mt-1">{note}</p>

    {/* The words above carry the meaning. The bars only show it at a glance. */}
    <div aria-hidden="true" className="mt-4 space-y-2">
      <BarRow label={nowLabel} width={bars.now} className="bg-slate-400" text={nowText} />
      <BarRow label={afterLabel} width={bars.after} className={tone} text={afterText} />
    </div>
  </div>
);

/** A labelled bar; its width is a share of the larger of the two values. */
const BarRow: React.FC<{ label: string; width: number; className: string; text?: string }> = ({
  label,
  width,
  className,
  text,
}) => (
  <div className="flex items-center gap-2 text-sm text-slate-800">
    <span className="w-28 shrink-0">{label}</span>
    <span className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
      <span className={`block h-full rounded-full ${className}`} style={{ width: `${width}%` }} />
    </span>
    {text && <span className="w-16 shrink-0 text-right font-semibold">{text}</span>}
  </div>
);

/** The engine's result for one what-if change, with a verdict, two fact cards and the explanation. */
const WhatIfAnswer: React.FC<{
  result: MatchedResult;
  dict: Dictionary;
}> = ({ result, dict }) => {
  const t = dict.whatIf;
  const name = result.memberName;
  const { verdict, airHeadline, fumesHeadline, airBars, fumeBars, airTone, fumesTone } =
    describeChange(result, t);

  return (
    <div className="space-y-4">
      <VerdictBanner result={result} verdict={verdict} dict={dict} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FactCard
          icon={Wind}
          title={formatMessage(t.breathTitle, { name })}
          headline={airHeadline}
          note={t.breathNote}
          nowLabel={t.barNow}
          afterLabel={t.barAfter}
          bars={airBars}
          tone={airTone}
        />
        <FactCard
          icon={Cloud}
          title={t.fumesTitle}
          headline={fumesHeadline}
          note={t.fumesNote}
          nowLabel={t.barNow}
          afterLabel={t.barAfter}
          bars={fumeBars}
          tone={fumesTone}
          nowText={`${formatKg(result.householdBaselineEmissionsKg)} kg`}
          afterText={`${formatKg(result.householdRecalculatedEmissionsKg)} kg`}
        />
      </div>

      <ExplanationCard explanation={result.explanation} t={t} />
    </div>
  );
};

/** Either the answer, or a plain note saying why the question could not be answered. */
export const WhatIfResultView: React.FC<{ result: WhatIfResult; dict: Dictionary }> = ({
  result,
  dict,
}) =>
  result.matched ? (
    <WhatIfAnswer result={result} dict={dict} />
  ) : (
    <p className={NOTICE}>
      {formatMessage(dict.whatIf.unmatched[result.reason], { name: result.memberName })}
    </p>
  );
