import React, { useId } from "react";
import { BarChart3 } from "lucide-react";
import { getAQIColor } from "@/domain/aqi";
import { formatHour } from "@/domain/labels";
import { HourlyAirQuality } from "@/domain/types";
import { Dictionary } from "@/i18n";
import { SectionHeader } from "./SectionHeader";
import { CARD } from "./styles";

const BAR_AREA_PX = 112;

interface HourlyAQIChartProps {
  hourly: HourlyAirQuality[];
  dict: Dictionary;
}

/** One bar per hour, each labelled with its AQI. Scrolls sideways on small screens. */
const HourlyBars: React.FC<{ rows: HourlyAirQuality[]; dict: Dictionary }> = ({ rows, dict }) => {
  const max = Math.max(100, ...rows.map((r) => r.aqi));
  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={dict.results.hourlyScrollLabel}
      className="overflow-x-auto rounded-lg"
    >
      <ol className="flex items-end gap-1.5 min-w-[720px] pt-2">
        {rows.map((r, i) => (
          <li
            key={r.time}
            className="relative flex-1 min-w-[26px] flex flex-col items-center justify-end"
          >
            <span className="sr-only">
              {`${formatHour(r.hour)}, ${dict.metrics.aqiLabel} ${r.aqi}, ${dict.categories[r.category]}`}
            </span>
            <span
              aria-hidden="true"
              className="text-[11px] font-mono font-semibold text-slate-900 mb-0.5"
            >
              {r.aqi}
            </span>
            <span
              aria-hidden="true"
              className="w-full rounded-t"
              style={{
                height: Math.max(4, Math.round((r.aqi / max) * BAR_AREA_PX)),
                backgroundColor: getAQIColor(r.category),
              }}
            />
            <span aria-hidden="true" className="text-[11px] text-slate-700 mt-1">
              {i === 0 ? dict.results.now : String(r.hour).padStart(2, "0")}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
};

/** The same hourly values as a table, for anyone who prefers to read numbers. */
const HourlyTable: React.FC<{ rows: HourlyAirQuality[]; dict: Dictionary }> = ({ rows, dict }) => (
  <details className="text-sm">
    <summary className="cursor-pointer font-medium text-sky-800 hover:text-sky-950">
      {dict.results.showTable}
    </summary>
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <caption className="sr-only">{dict.results.hourlyTitle}</caption>
        <thead>
          <tr className="border-b border-slate-300 text-slate-800">
            <th scope="col" className="py-1.5 pr-4 font-semibold">
              {dict.results.colHour}
            </th>
            <th scope="col" className="py-1.5 pr-4 font-semibold">
              {dict.results.colAQI}
            </th>
            <th scope="col" className="py-1.5 font-semibold">
              {dict.results.colCategory}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.time} className="border-b border-slate-100">
              <th scope="row" className="py-1.5 pr-4 font-mono font-normal">
                {formatHour(r.hour)}
              </th>
              <td className="py-1.5 pr-4 font-mono">{r.aqi}</td>
              <td className="py-1.5">{dict.categories[r.category]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </details>
);

/**
 * Bars are decorative. Every hour prints its AQI as a number, screen readers get
 * "hour, AQI, category" as text, and a table below repeats the same values.
 */
export const HourlyAQIChart: React.FC<HourlyAQIChartProps> = ({ hourly, dict }) => {
  const headingId = useId();
  const rows = hourly.slice(0, 24);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className={`${CARD} space-y-4`}>
      <SectionHeader
        id={headingId}
        icon={BarChart3}
        title={dict.results.hourlyTitle}
        intro={dict.results.hourlyDescription}
      />

      <HourlyBars rows={rows} dict={dict} />
      <HourlyTable rows={rows} dict={dict} />
    </section>
  );
};
