import React, { useId } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { ScheduleItem } from "@/domain/types";
import type { Dictionary } from "@/i18n";
import { formatMessage } from "@/i18n";
import { LocalizedAQIBadge } from "./AQIBadge";
import { SectionHeader } from "./SectionHeader";
import { CARD } from "./styles";

interface BeforeAfterTimelineProps {
  schedule: ScheduleItem[];
  dict: Dictionary;
}

/** One side of the comparison: the normal day or the optimized day. */
const DayColumn: React.FC<{
  label: string;
  activity: string;
  aqi: number;
  optimized: boolean;
  dict: Dictionary;
}> = ({ label, activity, aqi, optimized, dict }) => (
  <div
    className={`rounded-lg border p-3 space-y-2 ${
      optimized ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white"
    }`}
  >
    <p
      className={`text-xs font-bold uppercase tracking-wide ${
        optimized ? "text-emerald-900" : "text-slate-700"
      }`}
    >
      {label}
    </p>
    <p className="text-sm text-slate-900">{activity}</p>
    <LocalizedAQIBadge aqi={aqi} dict={dict} size="sm" />
  </div>
);

/** One hour: what changes, for whom, and why. */
const ScheduleRow: React.FC<{ item: ScheduleItem; dict: Dictionary }> = ({ item, dict }) => (
  <li className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/40">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="font-mono font-bold text-slate-900">{item.timeLabel}</h3>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200">
        {dict.results.actionTypes[item.actionType]}
      </span>
      {item.targetMember && (
        <span className="text-xs text-slate-700">
          {formatMessage(dict.results.forMember, { name: item.targetMember })}
        </span>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
      <DayColumn
        label={dict.results.colNormal}
        activity={item.normalActivity}
        aqi={item.normalAQI}
        optimized={false}
        dict={dict}
      />
      <ArrowRight
        className="hidden md:block w-5 h-5 self-center text-slate-500"
        aria-hidden="true"
      />
      <DayColumn
        label={dict.results.colOptimized}
        activity={item.optimizedActivity}
        aqi={item.optimizedAQI}
        optimized
        dict={dict}
      />
    </div>

    <p className="text-sm text-slate-800">
      <span className="font-semibold">{dict.results.colWhy}: </span>
      {item.rationale}
    </p>
  </li>
);

/** Each hour is one card, with the normal day and the optimized day labelled in words. */
export const BeforeAfterTimeline: React.FC<BeforeAfterTimelineProps> = ({ schedule, dict }) => {
  const headingId = useId();
  if (schedule.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <SectionHeader
        id={headingId}
        icon={CalendarClock}
        title={dict.sections.timeline}
        intro={dict.results.timelineIntro}
      />
      <ol className="space-y-4">
        {schedule.map((item, i) => (
          <ScheduleRow key={`${item.hour}-${i}`} item={item} dict={dict} />
        ))}
      </ol>
    </section>
  );
};
