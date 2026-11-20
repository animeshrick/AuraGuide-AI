import React, { useId, useMemo, useState } from "react";
import { Clock, OctagonAlert, ShieldAlert, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatHour } from "@/domain/labels";
import {
  OUTING_DURATIONS,
  OUTING_MODES,
  OutingDuration,
  OutingLevel,
  OutingMode,
  outingModeFor,
  planOuting,
} from "@/domain/outing";
import { HourlyAirQuality, HouseholdProfile } from "@/domain/types";
import { Dictionary, formatMessage } from "@/i18n";
import { AQIBadge } from "./AQIBadge";
import { CARD, SECTION_HEADING } from "./styles";

interface GoingOutPanelProps {
  profile: HouseholdProfile;
  hourly: readonly HourlyAirQuality[];
  dict: Dictionary;
}

const DEFAULT_HOUR = 8;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

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

const SELECT =
  "w-full min-h-[48px] px-3 py-2 rounded-xl border-2 border-slate-300 bg-white text-base";

/**
 * "I have to go out at this time." Live, with no submit button: the person, the hour, the length
 * of the trip and the way of travelling are chosen, and the verdict and steps follow at once.
 */
export const GoingOutPanel: React.FC<GoingOutPanelProps> = ({ profile, hourly, dict }) => {
  const uid = useId();
  const t = dict.outing;

  const [memberId, setMemberId] = useState(profile.members[0]?.id ?? "");
  const [hour, setHour] = useState(DEFAULT_HOUR);
  const [duration, setDuration] = useState<OutingDuration>("medium");
  // Null until the person picks one, so the way of travelling follows the chosen member.
  const [modeChoice, setModeChoice] = useState<OutingMode | null>(null);

  const member = profile.members.find((m) => m.id === memberId) ?? profile.members[0];
  const mode = modeChoice ?? (member ? outingModeFor(member.commuteMode) : "on_foot");

  const advice = useMemo(
    () => (member ? planOuting({ member, hourly, hour, duration, mode }) : null),
    [member, hourly, hour, duration, mode]
  );

  if (!member) return null;

  const look = advice ? LEVEL_LOOK[advice.level] : null;
  const time = formatHour(hour);

  return (
    <section aria-labelledby={`${uid}-h`} className={`${CARD} space-y-5`}>
      <div>
        <h2 id={`${uid}-h`} className={SECTION_HEADING}>
          <Clock className="w-5 h-5 text-sky-700" aria-hidden="true" />
          {t.title}
        </h2>
        <p className="text-base text-slate-800 mt-1 leading-relaxed">{t.intro}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`${uid}-who`}
            className="block text-base font-semibold text-slate-900 mb-1"
          >
            {t.who}
          </label>
          <select
            id={`${uid}-who`}
            value={member.id}
            onChange={(e) => {
              setMemberId(e.target.value);
              setModeChoice(null);
            }}
            className={SELECT}
          >
            {profile.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${uid}-when`}
            className="block text-base font-semibold text-slate-900 mb-1"
          >
            {t.when}
          </label>
          <select
            id={`${uid}-when`}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className={SELECT}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${uid}-long`}
            className="block text-base font-semibold text-slate-900 mb-1"
          >
            {t.duration}
          </label>
          <select
            id={`${uid}-long`}
            value={duration}
            onChange={(e) => setDuration(e.target.value as OutingDuration)}
            className={SELECT}
          >
            {OUTING_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {t.durations[d]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`${uid}-how`}
            className="block text-base font-semibold text-slate-900 mb-1"
          >
            {t.how}
          </label>
          <select
            id={`${uid}-how`}
            value={mode}
            onChange={(e) => setModeChoice(e.target.value as OutingMode)}
            className={SELECT}
          >
            {OUTING_MODES.map((m) => (
              <option key={m} value={m}>
                {t.modes[m]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="space-y-4">
        {!advice || !look ? (
          <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-base text-amber-950">
            {t.noData}
          </p>
        ) : (
          <>
            <div className={`rounded-2xl border-2 p-4 sm:p-5 flex items-start gap-4 ${look.box}`}>
              <span
                className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${look.icon}`}
              >
                <look.Icon className="w-6 h-6" aria-hidden="true" />
              </span>
              <div className="space-y-2">
                <h3 className="text-xl font-bold leading-snug">
                  {formatMessage(t.verdict[advice.level], { name: member.name, time })}
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
                  <p className="text-sm">{formatMessage(t.stricter, { name: member.name })}</p>
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
        )}
      </div>
    </section>
  );
};
