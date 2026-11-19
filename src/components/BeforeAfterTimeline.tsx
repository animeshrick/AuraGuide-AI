import React, { useId } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { getAQICategory } from "@/domain/aqi";
import { ScheduleItem } from "@/domain/types";
import { Dictionary, formatMessage } from "@/i18n";
import { AQIBadge } from "./AQIBadge";
import { CARD, MUTED, SECTION_HEADING } from "./styles";

interface BeforeAfterTimelineProps {
  schedule: ScheduleItem[];
  dict: Dictionary;
}

/** Each hour is one card, with the normal day and the optimized day labelled in words. */
export const BeforeAfterTimeline: React.FC<BeforeAfterTimelineProps> = ({ schedule, dict }) => {
  const headingId = useId();
  if (schedule.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <div>
        <h2 id={headingId} className={SECTION_HEADING}>
          <CalendarClock className="w-5 h-5 text-sky-700" aria-hidden="true" />
          {dict.sections.timeline}
        </h2>
        <p className={`${MUTED} mt-1`}>{dict.results.timelineIntro}</p>
      </div>

      <ol className="space-y-4">
        {schedule.map((item, i) => (
          <li
            key={`${item.hour}-${i}`}
            className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/40"
          >
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
              <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                  {dict.results.colNormal}
                </p>
                <p className="text-sm text-slate-900">{item.normalActivity}</p>
                <AQIBadge
                  aqi={item.normalAQI}
                  category={getAQICategory(item.normalAQI)}
                  categoryLabel={dict.categories[getAQICategory(item.normalAQI)]}
                  aqiLabel={dict.metrics.aqiLabel}
                  size="sm"
                />
              </div>

              <ArrowRight
                className="hidden md:block w-5 h-5 self-center text-slate-500"
                aria-hidden="true"
              />

              <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">
                  {dict.results.colOptimized}
                </p>
                <p className="text-sm text-slate-900">{item.optimizedActivity}</p>
                <AQIBadge
                  aqi={item.optimizedAQI}
                  category={getAQICategory(item.optimizedAQI)}
                  categoryLabel={dict.categories[getAQICategory(item.optimizedAQI)]}
                  aqiLabel={dict.metrics.aqiLabel}
                  size="sm"
                />
              </div>
            </div>

            <p className="text-sm text-slate-800">
              <span className="font-semibold">{dict.results.colWhy}: </span>
              {item.rationale}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
};
