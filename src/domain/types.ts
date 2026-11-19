export type AQICategory =
  | "Good"
  | "Satisfactory"
  | "Moderate"
  | "Poor"
  | "Very Poor"
  | "Severe";

export type HealthSensitivity =
  | "asthma"
  | "pregnant"
  | "infant"
  | "elderly"
  | "outdoor_worker"
  | "cardiac"
  | "none";

export type CommuteMode =
  | "walk"
  | "bicycle"
  | "two_wheeler"
  | "auto_rickshaw"
  | "bus"
  | "metro"
  | "car_ice"
  | "car_ev"
  | "work_from_home";

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
  | "schedule_shift"
  | "mode_swap"
  | "indoor_protection"
  | "purifier_timing";

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

export interface DailyPlanResponse {
  /** true when the rule-based plan is shown instead of the AI plan. */
  isFallback: boolean;
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
}

export interface PlanSummary {
  householdExposureAvoidedPct: number;
  baselineDoseTotal: number;
  optimizedDoseTotal: number;
  highestRiskMember: { memberId: string; memberName: string; baselineExposureDose: number } | null;
  emissionsSavedKg: number;
  emissionsSavedPct: number;
}

export type WhatIfReason = "no_mode" | "same_mode" | "no_commute";

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
