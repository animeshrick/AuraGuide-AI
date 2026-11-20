"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  Bike,
  Bus,
  CarFront,
  Cloud,
  Equal,
  Footprints,
  House,
  MessageCircleQuestion,
  Scale,
  Send,
  ThumbsUp,
  TrainFront,
  TriangleAlert,
  Wind,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CommuteMode, HouseholdProfile } from "@/domain/types";
import { staysAtHome } from "@/domain/modes";
import { Dictionary, formatMessage, SupportedLanguage } from "@/i18n";
import { ApiClientError, ClientErrorCode, requestWhatIf, WhatIfResult } from "@/lib/api-client";
import { formatKg } from "@/lib/format";
import { barWidths, WhatIfVerdict, whatIfVerdict } from "@/lib/whatif-verdict";
import { StatusBanner } from "./StatusBanner";
import { CARD, SECTION_HEADING } from "./styles";

interface WhatIfPanelProps {
  profile: HouseholdProfile;
  language: SupportedLanguage;
  dict: Dictionary;
}

/** The few ways of travelling offered as big buttons. Anything else can be typed as a question. */
const OPTION_MODES = ["metro", "bus", "bicycle", "walk", "car_ev", "work_from_home"] as const;
type OptionMode = (typeof OPTION_MODES)[number];

const OPTION_ICONS: Record<OptionMode, LucideIcon> = {
  metro: TrainFront,
  bus: Bus,
  bicycle: Bike,
  walk: Footprints,
  car_ev: CarFront,
  work_from_home: House,
};

/** Each verdict has a word, an icon and a colour, so colour is never the only signal. */
const VERDICT_LOOK: Record<
  WhatIfVerdict,
  { Icon: LucideIcon; box: string; icon: string; bar: string }
> = {
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

export const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ profile, language, dict }) => {
  const uid = useId();
  const [memberId, setMemberId] = useState(profile.members[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<ClientErrorCode | null>(null);
  const [activeMode, setActiveMode] = useState<OptionMode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const member = profile.members.find((m) => m.id === memberId) ?? profile.members[0];
  const canChange = !!member && !staysAtHome(member.commuteMode) && member.commuteDistanceKm > 0;

  const ask = async (text: string, toMode?: CommuteMode) => {
    const trimmed = text.trim();
    if (trimmed.length < 3) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const answer = await requestWhatIf(
        { profile, question: trimmed, memberId: memberId || undefined, toMode, language },
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

  const chooseMember = (id: string) => {
    // An answer about one person must not stay on screen under another person's name.
    abortRef.current?.abort();
    setLoading(false);
    setMemberId(id);
    setResult(null);
    setError(null);
    setActiveMode(null);
  };

  const chooseMode = (mode: OptionMode) => {
    if (!member) return;
    setActiveMode(mode);
    void ask(
      formatMessage(dict.whatIf.optionQuestion, {
        name: member.name,
        mode: dict.whatIf.options[mode],
      }),
      mode
    );
  };

  const modeChoices = OPTION_MODES.filter((mode) => mode !== member?.commuteMode);

  return (
    <section aria-labelledby={`${uid}-h`} className={`${CARD} space-y-6`}>
      <div>
        <h2 id={`${uid}-h`} className={SECTION_HEADING}>
          <MessageCircleQuestion className="w-5 h-5 text-sky-700" aria-hidden="true" />
          {dict.sections.whatIfTitle}
        </h2>
        <p className="text-base text-slate-800 mt-1 leading-relaxed">{dict.whatIf.intro}</p>
      </div>

      <div className="max-w-sm">
        <label htmlFor={`${uid}-who`} className="block text-base font-semibold text-slate-900 mb-1">
          {dict.whatIf.who}
        </label>
        <select
          id={`${uid}-who`}
          value={memberId}
          onChange={(e) => chooseMember(e.target.value)}
          className="w-full min-h-[48px] px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-base"
        >
          {profile.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {member && canChange ? (
        <div>
          <p id={`${uid}-pick`} className="text-base font-semibold text-slate-900 mb-2">
            {dict.whatIf.pickMode}
          </p>
          <div
            role="group"
            aria-labelledby={`${uid}-pick`}
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          >
            {modeChoices.map((mode) => {
              const Icon = OPTION_ICONS[mode];
              const selected = activeMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={selected}
                  disabled={loading}
                  onClick={() => chooseMode(mode)}
                  className={`flex items-center justify-center gap-2 min-h-[56px] px-3 py-2 rounded-xl border-2 text-base font-semibold transition disabled:opacity-60 ${
                    selected
                      ? "bg-sky-700 text-white border-sky-700"
                      : "bg-white text-slate-900 border-slate-300 hover:border-sky-600 hover:bg-sky-50"
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                  {dict.whatIf.options[mode]}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        member && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
            {formatMessage(dict.whatIf.unmatched.no_commute, { name: member.name })}
          </p>
        )
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setActiveMode(null);
          void ask(question);
        }}
        className="space-y-3 pt-4 border-t border-slate-200"
      >
        <label htmlFor={`${uid}-q`} className="block text-base font-semibold text-slate-900">
          {dict.whatIf.question}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            id={`${uid}-q`}
            type="text"
            required
            minLength={3}
            maxLength={300}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={dict.whatIf.placeholder}
            className="flex-1 min-h-[48px] px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-base"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-base font-semibold disabled:opacity-60"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            {loading ? dict.whatIf.asking : dict.whatIf.ask}
          </button>
        </div>
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
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
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
  const t = dict.whatIf;
  const name = result.memberName;

  const airPct = Math.round(result.exposureChangePercentage);
  const savedKg = Math.round(result.savedEmissionsKg * 100) / 100;
  const verdict = whatIfVerdict(result.exposureChangePercentage, result.savedEmissionsKg);
  const look = VERDICT_LOOK[verdict];

  const airHeadline =
    airPct < 0
      ? formatMessage(t.breathBetter, { pct: Math.abs(airPct) })
      : airPct > 0
        ? formatMessage(t.breathWorse, { pct: airPct })
        : t.breathSame;
  const fumesHeadline =
    savedKg > 0
      ? formatMessage(t.fumesBetter, { kg: formatKg(savedKg) })
      : savedKg < 0
        ? formatMessage(t.fumesWorse, { kg: formatKg(Math.abs(savedKg)) })
        : t.fumesSame;

  // Less dirty air is a shorter bar, so a longer "after" bar is the worse result.
  const airBars = barWidths(100, 100 + airPct);
  const fumeBars = barWidths(
    result.householdBaselineEmissionsKg,
    result.householdRecalculatedEmissionsKg
  );
  const airTone =
    airPct < 0 ? VERDICT_LOOK.better.bar : airPct > 0 ? VERDICT_LOOK.worse.bar : "bg-slate-500";
  const fumesTone =
    savedKg > 0 ? VERDICT_LOOK.better.bar : savedKg < 0 ? VERDICT_LOOK.worse.bar : "bg-slate-500";

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border-2 p-4 sm:p-5 flex items-start gap-4 ${look.box}`}>
        <span
          className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${look.icon}`}
        >
          <look.Icon className="w-6 h-6" aria-hidden="true" />
        </span>
        <div>
          <h3 className="text-xl font-bold leading-snug">
            {formatMessage(t.verdict[verdict], { name })}
          </h3>
          <p className="text-base mt-1">
            {formatMessage(t.changeLine, {
              from: t.modeShort[result.fromMode],
              to: t.modeShort[result.toMode],
            })}
          </p>
        </div>
      </div>

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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
        <h4 className="text-base font-bold text-slate-900">{t.simpleWords}</h4>
        <p className="text-base text-slate-900 leading-relaxed whitespace-pre-line">
          {result.explanation}
        </p>
        <p className="text-sm text-slate-700">
          {result.explanationSource === "gemini" ? t.viaGemini : t.viaRules}
          {". "}
          {t.numbersNote}
        </p>
      </div>
    </div>
  );
};

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
  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
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
