import React, { useId } from "react";
import { CalendarDays, OctagonAlert, ShieldAlert, ShieldCheck, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatHourRange } from "@/domain/labels";
import type { DayOutlook, OutlookLevel } from "@/domain/types";
import type { Dictionary, SupportedLanguage } from "@/i18n";
import { formatMessage } from "@/i18n";
import { formatDayLabel } from "@/lib/dates";
import { LocalizedAQIBadge } from "./AQIBadge";
import { SectionHeader } from "./SectionHeader";
import { CARD, MUTED } from "./styles";

interface OutlookPanelProps {
  outlook: DayOutlook[];
  language: SupportedLanguage;
  dict: Dictionary;
}

/** Each level has a word, an icon and a colour, so colour is never the only signal. */
const LEVEL_LOOK: Record<OutlookLevel, { Icon: LucideIcon; text: string }> = {
  good: { Icon: ShieldCheck, text: "text-emerald-800" },
  careful: { Icon: ShieldAlert, text: "text-amber-800" },
  avoid: { Icon: OctagonAlert, text: "text-rose-800" },
};

/** One day: its name, daytime AQI, what that means and the cleanest time to go out. */
const DayCard: React.FC<{ day: DayOutlook; language: SupportedLanguage; dict: Dictionary }> = ({
  day,
  language,
  dict,
}) => {
  const t = dict.outlook;
  const look = LEVEL_LOOK[day.level];
  return (
    <li
      className={`p-4 rounded-xl border space-y-3 ${
        day.isBestDay ? "border-emerald-400 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">{formatDayLabel(day.date, language)}</h3>
        {day.isBestDay && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">
            <Star className="w-3 h-3" aria-hidden="true" />
            {t.bestDay}
          </span>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
        {t.daytimeAir}
        <LocalizedAQIBadge aqi={day.averageAQI} category={day.category} dict={dict} size="md" />
      </p>
      <p className={`flex items-center gap-2 text-base font-semibold ${look.text}`}>
        <look.Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
        {t.levels[day.level]}
      </p>
      <p className="text-sm text-slate-900">
        {formatMessage(t.bestTime, {
          time: formatHourRange(day.bestWindow.startHour, day.bestWindow.endHour),
        })}
      </p>
      <p className={MUTED}>{formatMessage(t.worstHour, { aqi: day.peakAQI })}</p>
    </li>
  );
};

/** The next three days, so outings, laundry and errands can go on the cleanest day. */
export const OutlookPanel: React.FC<OutlookPanelProps> = ({ outlook, language, dict }) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <SectionHeader
        id={headingId}
        icon={CalendarDays}
        title={dict.outlook.title}
        intro={dict.outlook.intro}
        largeIntro
      />
      {outlook.length === 0 ? (
        <p className={MUTED}>{dict.outlook.unavailable}</p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {outlook.map((day) => (
            <DayCard key={day.date} day={day} language={language} dict={dict} />
          ))}
        </ul>
      )}
    </section>
  );
};
