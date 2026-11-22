import React from "react";
import { Lightbulb } from "lucide-react";
import { DailyPlanResponse, HouseholdProfile } from "@/domain/types";
import { Dictionary, formatMessage, SupportedLanguage } from "@/i18n";
import { BeforeAfterTimeline } from "./BeforeAfterTimeline";
import { CommunityAdvisory } from "./CommunityAdvisory";
import { EmissionsPanel } from "./EmissionsPanel";
import { HourlyAQIChart } from "./HourlyAQIChart";
import { ImpactSummary } from "./ImpactSummary";
import { GoingOutPanel } from "./GoingOutPanel";
import { IndoorAirPanel } from "./IndoorAirPanel";
import { MemberImpactCards } from "./MemberImpactCards";
import { OutlookPanel } from "./OutlookPanel";
import { SafeWindowTimeline } from "./SafeWindowTimeline";
import { StatusBanner } from "./StatusBanner";
import { PlantsPanel } from "./PlantsPanel";
import { WhatIfPanel } from "./WhatIfPanel";
import { CARD } from "./styles";

interface PlanResultsProps {
  plan: DailyPlanResponse;
  profile: HouseholdProfile;
  language: SupportedLanguage;
  dict: Dictionary;
  /** True while the same plan is being rewritten in another language. */
  isUpdating: boolean;
  headingRef: React.Ref<HTMLHeadingElement>;
}

/** Every section of a finished plan, in reading order. */
export const PlanResults: React.FC<PlanResultsProps> = ({
  plan,
  profile,
  language,
  dict,
  isUpdating,
  headingRef,
}) => {
  const showModelledNotice = plan.airQuality.source === "modelled";

  return (
    <div className="space-y-6">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight outline-none"
      >
        {formatMessage(dict.results.heading, { city: plan.city })}
      </h1>

      {(showModelledNotice || isUpdating) && (
        <div className="space-y-3">
          {showModelledNotice && (
            <StatusBanner tone="warning">{dict.banners.modelled}</StatusBanner>
          )}
          {isUpdating && <StatusBanner tone="info">{dict.banners.updatingLanguage}</StatusBanner>}
        </div>
      )}

      <ImpactSummary plan={plan} dict={dict} />
      <HourlyAQIChart hourly={plan.airQuality.hourly} dict={dict} />
      <SafeWindowTimeline safeWindows={plan.safeWindows} dict={dict} />
      <OutlookPanel outlook={plan.outlook} language={language} dict={dict} />
      <BeforeAfterTimeline schedule={plan.schedule} dict={dict} />
      <MemberImpactCards impacts={plan.memberImpacts} dict={dict} />
      <EmissionsPanel impact={plan.emissionImpact} dict={dict} />
      <IndoorAirPanel advice={plan.indoorAir} dict={dict} />
      <PlantsPanel profile={profile} dict={dict} />

      {plan.communityTip && (
        <aside className={`${CARD} flex items-start gap-3`}>
          <Lightbulb className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {dict.results.communityTipHeading}
            </h2>
            <p className="text-sm text-slate-800 mt-1 leading-relaxed">{plan.communityTip}</p>
          </div>
        </aside>
      )}

      <GoingOutPanel profile={profile} hourly={plan.airQuality.hourly} dict={dict} />
      <WhatIfPanel profile={profile} language={language} dict={dict} />
      <CommunityAdvisory city={plan.city} language={language} dict={dict} />

      <p className="text-xs text-slate-700">{dict.results.methodNote}</p>
    </div>
  );
};
