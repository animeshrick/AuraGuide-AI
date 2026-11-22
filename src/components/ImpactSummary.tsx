import React, { useId } from "react";
import { Gauge, Leaf, ShieldCheck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { summarizePlan } from "@/domain/summary";
import { DailyPlanResponse } from "@/domain/types";
import { Dictionary, formatMessage } from "@/i18n";
import { formatKg, localClock } from "@/lib/format";
import { AQIBadge } from "./AQIBadge";
import { CARD, MUTED } from "./styles";

interface ImpactSummaryProps {
  plan: DailyPlanResponse;
  dict: Dictionary;
}

/** One headline number: an icon, a label and the value below it. */
const MetricCard: React.FC<{
  icon: LucideIcon;
  iconColor: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}> = ({ icon: Icon, iconColor, label, className = "", children }) => (
  <div className={`${CARD} space-y-1`}>
    <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-700">
      <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
      {label}
    </dt>
    <dd className={className}>{children}</dd>
  </div>
);

/** The current AQI with its main pollutant, particle levels and update time. */
const CurrentAirValue: React.FC<ImpactSummaryProps> = ({ plan, dict }) => {
  const { airQuality } = plan;
  const clock = localClock(airQuality.hourly[0]?.time);
  return (
    <>
      <AQIBadge
        aqi={plan.currentAQI}
        category={plan.currentCategory}
        categoryLabel={dict.categories[plan.currentCategory]}
        aqiLabel={dict.metrics.aqiLabel}
        size="lg"
      />
      <span className={`${MUTED} block`}>
        {dict.metrics.primaryPollutant}: {airQuality.primaryPollutant}
      </span>
      <span className="text-xs text-slate-700 block">
        {formatMessage(dict.results.pm25, { value: Math.round(airQuality.pm25) })}
        {" · "}
        {formatMessage(dict.results.pm10, { value: Math.round(airQuality.pm10) })}
      </span>
      {clock && (
        <span className="text-xs text-slate-600 block">
          {formatMessage(dict.results.dataUpdated, { time: clock })}
        </span>
      )}
    </>
  );
};

/** The headline numbers: current AQI, exposure avoided and emissions saved. */
export const ImpactSummary: React.FC<ImpactSummaryProps> = ({ plan, dict }) => {
  const headingId = useId();
  const summary = summarizePlan(plan);
  const savedKg = formatKg(summary.emissionsSavedKg);
  const riskiest = summary.highestRiskMember;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h2 id={headingId} className="sr-only">
        {dict.results.summaryHeading}
      </h2>

      <p className="text-base text-slate-900 leading-relaxed">{plan.summary}</p>

      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={ShieldCheck}
          iconColor="text-emerald-700"
          label={dict.metrics.exposureAvoided}
        >
          <span className="text-4xl font-extrabold text-slate-900">
            {summary.householdExposureAvoidedPct}%
          </span>
          <span className={`${MUTED} block mt-1`}>{dict.results.exposureHint}</span>
        </MetricCard>

        <MetricCard icon={Leaf} iconColor="text-teal-700" label={dict.metrics.emissionsSaved}>
          <span className="text-4xl font-extrabold text-slate-900">
            {savedKg}
            <span className="text-base font-semibold text-slate-700"> kg</span>
          </span>
          <span className={`${MUTED} block mt-1`}>
            {formatMessage(dict.results.emissionsHint, {
              kg: savedKg,
              pct: summary.emissionsSavedPct,
            })}
          </span>
        </MetricCard>

        <MetricCard
          icon={Gauge}
          iconColor="text-sky-700"
          label={dict.metrics.currentAQI}
          className="space-y-1.5"
        >
          <CurrentAirValue plan={plan} dict={dict} />
        </MetricCard>

        <MetricCard
          icon={UserRound}
          iconColor="text-amber-700"
          label={dict.metrics.highestRisk}
          className="text-xl font-bold text-slate-900 break-words"
        >
          {riskiest
            ? formatMessage(dict.results.highestRiskValue, { name: riskiest.memberName })
            : "-"}
        </MetricCard>
      </dl>
    </section>
  );
};
