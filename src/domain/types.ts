/** The six bands of India's National Air Quality Index, cleanest first. */
export type AQICategory = "Good" | "Satisfactory" | "Moderate" | "Poor" | "Very Poor" | "Severe";

/** A reason a person is harmed more by dirty air. "none" is the form's explicit empty choice. */
export type HealthSensitivity =
  "asthma" | "pregnant" | "infant" | "elderly" | "outdoor_worker" | "cardiac" | "none";

/** How a person travels to work or school. The last two mean no daily commute. */
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

/** What the household cooks on. Biomass (wood, dung, crop waste) adds smoke indoors. */
export type CookingFuel = "lpg" | "biomass" | "electric";

/** Languages the plan can be written in: English, Hindi and Bengali. */
export type SupportedLanguageCode = "en" | "hi" | "bn";

/** Something a person regularly does outside, such as a morning walk. */
export interface OutdoorActivity {
  description: string;
  preferredHour: number; // 0 - 23
  durationMinutes: number;
}

/** One person in the household, with the habits and health details the engine needs. */
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

/** Everything the household form collects. This is the body of a plan request. */
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

/** Air quality for one hour at one place. */
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

/** Air quality for a place right now, with the hours ahead. Used on the server only. */
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

/** The part of the air quality data that is sent to the browser with a plan. */
export interface PlanAirQuality {
  source: AirQualitySource;
  updatedAt: string;
  pm25: number;
  pm10: number;
  primaryPollutant: "PM2.5" | "PM10";
  hourly: HourlyAirQuality[];
}

/** The cleanest stretch of the day for one kind of activity. */
export interface SafeWindow {
  activity: "school_run" | "exercise" | "ventilation" | "general_outdoor";
  startHour: number; // 0 - 23
  endHour: number; // 1 - 24
  averageAQI: number;
  category: AQICategory;
  recommendation: string;
}

/** How much less dirty air one person breathes when the plan is followed. */
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

/** Daily commute CO2 for the household, before and after the suggested mode swaps. */
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

/** The kind of change a schedule step makes. It decides how the step's "after" AQI is worked out. */
export type ScheduleActionType =
  "schedule_shift" | "mode_swap" | "indoor_protection" | "purifier_timing";

/** One step of the day: what the household does now, what to do instead, and why. */
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

/** Advice for the air inside the home, written by Gemini. */
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

/** One day of the 3-day outlook. */
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

/** The full answer of the plan route: engine numbers with Gemini's wording. */
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

/** Household totals shown at the top of the results. */
export interface PlanSummary {
  householdExposureAvoidedPct: number;
  baselineDoseTotal: number;
  optimizedDoseTotal: number;
  highestRiskMember: { memberId: string; memberName: string; baselineExposureDose: number } | null;
  emissionsSavedKg: number;
  emissionsSavedPct: number;
}

/** Why a what-if question could not be answered. */
type WhatIfReason = "no_mode" | "same_mode" | "no_commute";

/** The engine's answer to a what-if question: the recalculated numbers, or the reason there are none. */
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
