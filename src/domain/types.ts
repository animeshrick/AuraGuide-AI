export type AQICategory = "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe";

export type HealthSensitivity =
  "asthma" | "pregnant" | "infant" | "elderly" | "outdoor_worker" | "cardiac" | "none";

export type CommuteMode =
  | "walk"
  | "bicycle"
  | "two_wheeler"
  | "auto_rickshaw"
  | "bus"
  | "metro"
  | "car_ice"
  | "car_ev"
  | "work_from_home"
  | "homemaker";

export type CookingFuel = "lpg" | "biomass" | "electric";

export type SupportedLanguageCode = "en" | "hi" | "bn";

export interface OutdoorActivity {
  description: string;
  preferredHour: number; // 0 - 23
  durationMinutes: number;
}

export interface HouseholdMember {
  id: string;
  name: string;
  age: number;
  sensitivities: HealthSensitivity[];
  /** Optional. True when the person smokes or vapes. Left out when not said. */
  smokes?: boolean;
  commuteMode: CommuteMode;
  commuteDistanceKm: number; // one way
  commuteTimeMinutes: number; // one way
  outdoorActivities: OutdoorActivity[];
}

export interface HouseholdProfile {
  city: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  members: HouseholdMember[];
  cookingFuel: CookingFuel;
  usesIncenseOrCoils: boolean;
  hasAirPurifier: boolean;
  language?: SupportedLanguageCode;
}

export interface HourlyAirQuality {
  time: string; // local ISO string without offset, e.g. 2026-11-19T18:00
  hour: number; // 0 - 23, local hour of day
  pm25: number; // µg/m³
  pm10: number; // µg/m³
  aqi: number;
  category: AQICategory;
}

/** "open-meteo" is live modelled data. "modelled" is the built-in typical winter pattern used when the data source is unreachable. */
export type AirQualitySource = "open-meteo" | "modelled";

export interface CurrentAirQuality {
  city: string;
  latitude: number;
  longitude: number;
  aqi: number;
  pm25: number;
  pm10: number;
  category: AQICategory;
  primaryPollutant: "PM2.5" | "PM10";
  updatedAt: string;
  dataSource: AirQualitySource;
  /** First entry is the current local hour; entries are consecutive hours. */
  hourly: HourlyAirQuality[];
  /** Every forecast hour from now on, up to several days ahead. Missing for modelled data. */
  forecastHours?: HourlyAirQuality[];
}

export interface PlanAirQuality {
  source: AirQualitySource;
  updatedAt: string;
  pm25: number;
  pm10: number;
  primaryPollutant: "PM2.5" | "PM10";
  hourly: HourlyAirQuality[];
}

export interface SafeWindow {
  activity: "school_run" | "exercise" | "ventilation" | "general_outdoor";
  startHour: number; // 0 - 23
  endHour: number; // 1 - 24
  averageAQI: number;
  category: AQICategory;
  recommendation: string;
}

export interface MemberExposureImpact {
  memberId: string;
  memberName: string;
  /** Vulnerability-weighted inhaled PM2.5 index for a normal day (µg). */
  baselineExposureDose: number;
  /** Same index when the plan is followed. */
  optimizedExposureDose: number;
  exposureAvoidedPercentage: number;
  keyChanges: string[];
}

export interface EmissionImpact {
  baselineEmissionsKg: number;
  optimizedEmissionsKg: number;
  savedEmissionsKg: number;
  modeSwaps: {
    from: CommuteMode;
    to: CommuteMode;
    savedKg: number;
  }[];
}

export type ScheduleActionType =
  "schedule_shift" | "mode_swap" | "indoor_protection" | "purifier_timing";

export interface ScheduleItem {
  hour: number;
  timeLabel: string;
  normalActivity: string;
  normalAQI: number;
  optimizedActivity: string;
  optimizedAQI: number;
  rationale: string;
  targetMember?: string;
  actionType: ScheduleActionType;
}

export interface IndoorAirAdvice {
  cookingAdvice: string;
  ventilationWindow: string;
  purifierStrategy: string;
  hazardWarnings: string[];
}

/** Who a community advisory can be written for, in the order they are offered. */
export const ADVISORY_AUDIENCES = ["housing_society", "school", "general_public"] as const;

/** Who a community advisory is written for. */
export type AdvisoryAudience = (typeof ADVISORY_AUDIENCES)[number];

/** good: a fine day to be outside; careful: keep outings short; avoid: stay in where possible. */
export type OutlookLevel = "good" | "careful" | "avoid";

export interface DayOutlook {
  /** Local date, for example "2026-11-23". */
  date: string;
  /** Average AQI over the daytime hours. */
  averageAQI: number;
  category: AQICategory;
  /** The worst daytime hour. */
  peakAQI: number;
  level: OutlookLevel;
  /** The cleanest two daytime hours. */
  bestWindow: { startHour: number; endHour: number; averageAQI: number };
  /** True for the cleanest day in the outlook. */
  isBestDay: boolean;
}

export interface DailyPlanResponse {
  city: string;
  currentAQI: number;
  currentCategory: AQICategory;
  summary: string;
  airQuality: PlanAirQuality;
  safeWindows: SafeWindow[];
  memberImpacts: MemberExposureImpact[];
  emissionImpact: EmissionImpact;
  schedule: ScheduleItem[];
  indoorAir: IndoorAirAdvice;
  communityTip: string;
  /** The next few days, calculated by the engine. Empty when there is no live forecast. */
  outlook: DayOutlook[];
}

export interface PlanSummary {
  householdExposureAvoidedPct: number;
  baselineDoseTotal: number;
  optimizedDoseTotal: number;
  highestRiskMember: { memberId: string; memberName: string; baselineExposureDose: number } | null;
  emissionsSavedKg: number;
  emissionsSavedPct: number;
}

type WhatIfReason = "no_mode" | "same_mode" | "no_commute";

export type WhatIfOutcome =
  | {
      matched: false;
      reason: WhatIfReason;
      memberId: string;
      memberName: string;
      fromMode: CommuteMode;
    }
  | {
      matched: true;
      memberId: string;
      memberName: string;
      fromMode: CommuteMode;
      toMode: CommuteMode;
      householdBaselineEmissionsKg: number;
      householdRecalculatedEmissionsKg: number;
      savedEmissionsKg: number;
      baselineExposureDose: number;
      recalculatedExposureDose: number;
      /** Positive means the member inhales more PM2.5 after the change. */
      exposureChangePercentage: number;
    };
