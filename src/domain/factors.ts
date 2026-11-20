import { CommuteMode, HealthSensitivity } from "./types";

/**
 * Emission factors in kg CO2e per passenger-kilometer.
 * Sources:
 * - Indian Central Electricity Authority (CEA) CO2 Baseline Database
 * - Delhi Metro Rail Corporation (DMRC) Carbon Offset Reports
 * - ARAI (Automotive Research Association of India) emission averages
 * - TERI Urban Mobility study
 */
export const EMISSION_FACTORS_KG_PER_KM: Record<CommuteMode, number> = {
  walk: 0.0,
  bicycle: 0.0,
  metro: 0.016, // electrified urban rail with Indian grid average
  bus: 0.042, // CNG / Diesel municipal transit per passenger-km
  two_wheeler: 0.038, // 110-150cc petrol commuter
  auto_rickshaw: 0.068, // CNG three-wheeler per passenger-km
  car_ev: 0.053, // electric four-wheeler at Indian grid carbon intensity
  car_ice: 0.175, // petrol/diesel private car
  work_from_home: 0.0,
  homemaker: 0.0,
};

/**
 * Exposure vulnerability multiplier based on physiological health sensitivities.
 * E.g., infants and individuals with asthma have significantly higher deposition
 * efficiency and bronchial vulnerability to fine particulate matter.
 * When a person has several conditions the highest multiplier is used (not summed).
 */
export const HEALTH_SENSITIVITY_MULTIPLIERS: Record<HealthSensitivity, number> = {
  none: 1.0,
  asthma: 2.2, // increased pulmonary reactivity
  cardiac: 1.8, // cardiovascular inflammation risk
  pregnant: 1.7, // placental particulate risk & maternal oxygenation
  infant: 2.5, // narrow airways, higher respiratory rate per body weight
  elderly: 1.6, // reduced clearance efficiency
  outdoor_worker: 1.5, // sustained ambient inhalation burden
};

/**
 * Multiplier for a person who smokes or vapes. Their airways are already irritated, so the same
 * dose of fine particles does more harm. It is an estimate for comparing choices, not a clinical
 * figure, and it is used the same way as the sensitivities above (the highest one counts).
 */
export const SMOKER_MULTIPLIER = 1.4;

/**
 * Inhalation rate estimates in m³/hour based on EPA Exposure Factors Handbook
 * and CPCB respiratory guidelines.
 */
export const INHALATION_RATES_M3_PER_HOUR = {
  resting: 0.45,
  sedentary_indoor: 0.6,
  light_commute: 0.85,
  walking: 1.3,
  cycling_strenuous: 2.5,
};

/**
 * Indoor air reduction factors (fraction of outdoor particulate infiltrating).
 */
export const INFILTRATION_FACTORS = {
  standard_closed_windows: 0.65, // 35% reduction from building envelope
  open_windows: 0.95,
  with_hepa_purifier: 0.2, // 80% indoor PM2.5 reduction
  biomass_indoor_added_pm: 80, // added indoor PM2.5 µg/m³ during cooking
  incense_coil_added_pm: 45, // added indoor PM2.5 µg/m³
};

/**
 * Share of ambient PM that still reaches the lungs when a person wears an N95
 * respirator. Lab fit-tested N95s let through about 5%; 0.4 assumes the
 * imperfect fit of untrained everyday wearers, so the plan does not overstate
 * the benefit of a mask.
 */
export const N95_PENETRATION = 0.4;

/**
 * Multiplier on ambient PM2.5 for the air a person breathes while travelling.
 * Above 1: on-road exhaust plume in open traffic. Below 1: enclosed or
 * partially filtered cabins.
 */
export const COMMUTE_AMBIENT_FACTOR: Record<CommuteMode, number> = {
  walk: 1.25,
  bicycle: 1.25,
  two_wheeler: 1.25,
  auto_rickshaw: 1.0,
  bus: 0.7,
  metro: 0.7,
  car_ice: 1.0,
  car_ev: 1.0,
  work_from_home: 1.0,
  homemaker: 1.0,
};

/** Breathing rate while travelling, in m³/hour. */
export const COMMUTE_INHALATION_RATE: Record<CommuteMode, number> = {
  walk: INHALATION_RATES_M3_PER_HOUR.walking,
  bicycle: INHALATION_RATES_M3_PER_HOUR.cycling_strenuous,
  two_wheeler: INHALATION_RATES_M3_PER_HOUR.light_commute,
  auto_rickshaw: INHALATION_RATES_M3_PER_HOUR.light_commute,
  bus: INHALATION_RATES_M3_PER_HOUR.light_commute,
  metro: INHALATION_RATES_M3_PER_HOUR.light_commute,
  car_ice: INHALATION_RATES_M3_PER_HOUR.light_commute,
  car_ev: INHALATION_RATES_M3_PER_HOUR.light_commute,
  work_from_home: INHALATION_RATES_M3_PER_HOUR.light_commute,
  homemaker: INHALATION_RATES_M3_PER_HOUR.light_commute,
};

/**
 * Daily-routine assumptions used by the exposure model. They are fixed so that
 * the normal day and the optimised day are compared on the same footing.
 */
export const DAY_MODEL = {
  morningCommuteHour: 8,
  eveningCommuteHour: 18,
  /** People who commute spend these hours (inclusive) at work or school, not at home. */
  awayFromHome: { startHour: 9, endHour: 17 },
  cookingHours: [7, 19],
  /** Hours when incense or mosquito coils are typically burning. */
  incenseHours: [6, 18, 19],
  /** One commute leg counts for at most one hour of the day. */
  maxCommuteHoursPerLeg: 1,
} as const;

export function isSleepHour(hour: number): boolean {
  return hour >= 22 || hour < 6;
}
