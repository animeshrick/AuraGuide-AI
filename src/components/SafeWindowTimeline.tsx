import React, { useId } from "react";
import { Clock, Wind, Sun, BookOpen, Activity } from "lucide-react";
import { formatHourRange } from "@/domain/labels";
import { SafeWindow } from "@/domain/types";
import { Dictionary } from "@/i18n";
import { AQIBadge } from "./AQIBadge";
import { SectionHeader } from "./SectionHeader";
import { CARD, MUTED } from "./styles";

interface SafeWindowTimelineProps {
  safeWindows: SafeWindow[];
  dict: Dictionary;
}

const ICONS: Record<SafeWindow["activity"], React.ReactNode> = {
  ventilation: <Wind className="w-4 h-4 text-sky-700" aria-hidden="true" />,
  exercise: <Activity className="w-4 h-4 text-emerald-700" aria-hidden="true" />,
  school_run: <BookOpen className="w-4 h-4 text-amber-700" aria-hidden="true" />,
  general_outdoor: <Sun className="w-4 h-4 text-slate-700" aria-hidden="true" />,
};

/** The cleanest time windows today for exercise, the school run and airing the home. */
export const SafeWindowTimeline: React.FC<SafeWindowTimelineProps> = ({ safeWindows, dict }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <SectionHeader
        id={headingId}
        icon={Clock}
        title={dict.metrics.safeWindows}
        intro={dict.results.safeWindowsNote}
      />

      {safeWindows.length === 0 ? (
        <p className={MUTED}>{dict.results.noSafeWindows}</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {safeWindows.map((w) => (
            <li
              key={`${w.activity}-${w.startHour}`}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    {ICONS[w.activity]}
                    {dict.results.windowTitles[w.activity]}
                  </h3>
                  <AQIBadge
                    aqi={w.averageAQI}
                    category={w.category}
                    categoryLabel={dict.categories[w.category]}
                    aqiLabel={dict.metrics.aqiLabel}
                    size="sm"
                  />
                </div>
                <p className="text-xl font-extrabold text-slate-900 font-mono tracking-tight">
                  {formatHourRange(w.startHour, w.endHour)}
                </p>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed border-t border-slate-200 pt-2.5">
                {w.recommendation}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
