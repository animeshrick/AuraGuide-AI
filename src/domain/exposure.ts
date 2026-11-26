import { recommendModeSwap } from "./emissions";
import {
  COMMUTE_AMBIENT_FACTOR,
  COMMUTE_INHALATION_RATE,
  DAY_MODEL,
  HEALTH_SENSITIVITY_MULTIPLIERS,
  INFILTRATION_FACTORS,
  INHALATION_RATES_M3_PER_HOUR,
  N95_PENETRATION,
  SMOKER_MULTIPLIER,
  isSleepHour,
} from "./factors";
import { indexByHour, meanOf } from "./hourly";
import { COMMUTE_MODE_LABELS, formatHour } from "./labels";
import { staysAtHome } from "./modes";
import type {
  CommuteMode,
  HourlyAirQuality,
  HouseholdMember,
  HouseholdProfile,
  MemberExposureImpact,
  OutdoorActivity,
} from "./types";
import { shiftActivityHour } from "./windows";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

/** "normal" is the household's current habits. "optimized" is the day with the plan followed. */
export type ExposureScenario = "normal" | "optimized";

const COOKING_HOURS: readonly number[] = DAY_MODEL.cookingHours;
const INCENSE_HOURS: readonly number[] = DAY_MODEL.incenseHours;

/** What is adding to or cleaning the air at home during one hour. */
export interface IndoorSources {
  purifierRuns: boolean;
  cookingFuel: HouseholdProfile["cookingFuel"];
  incenseBurning: boolean;
  isCookingHour: boolean;
}

/** PM2.5 inside the home for one hour, from the outdoor level and the home's own sources. */
export function computeIndoorPm25(outdoorPm25: number, sources: IndoorSources): number {
  let indoor = outdoorPm25 * INFILTRATION_FACTORS.standard_closed_windows;
  if (sources.isCookingHour && sources.cookingFuel === "biomass") {
    indoor += INFILTRATION_FACTORS.biomass_indoor_added_pm;
  }
  if (sources.incenseBurning) indoor += INFILTRATION_FACTORS.incense_coil_added_pm;
  if (sources.purifierRuns) indoor *= INFILTRATION_FACTORS.with_hepa_purifier;
  return Math.round(indoor * 10) / 10;
}

/** The highest multiplier among a person's sensitivities (they are not added up). */
export function getSensitivityMultiplier(member: HouseholdMember): number {
  return member.sensitivities.reduce(
    (max, s) => Math.max(max, HEALTH_SENSITIVITY_MULTIPLIERS[s] ?? 1),
    member.smokes ? SMOKER_MULTIPLIER : 1
  );
}

/** Minutes of outdoor activity falling in each hour of the day, wrapping past midnight. */
function activityMinutesByHour(
  activities: readonly OutdoorActivity[],
  startHourFor: (activity: OutdoorActivity) => number
): Map<number, number> {
  const minutes = new Map<number, number>();
  for (const activity of activities) {
    let remaining = Math.max(0, activity.durationMinutes);
    let hour = startHourFor(activity);
    for (let step = 0; remaining > 0 && step < HOURS_PER_DAY; step++) {
      const slice = Math.min(MINUTES_PER_HOUR, remaining);
      const key = hour % HOURS_PER_DAY;
      minutes.set(key, (minutes.get(key) ?? 0) + slice);
      remaining -= slice;
      hour += 1;
    }
  }
  return minutes;
}

/**
 * Estimated PM2.5 a person inhales over 24 hours, weighted for vulnerability.
 * Meant for comparing choices on the same footing, not as a medical figure.
 *
 * Normal day: the household's current habits.
 * Optimised day: a HEPA purifier at home, no incense or coils, the commute made
 * by the recommended mode with a fitted N95, and outdoor activity moved to the
 * cleanest exercise hour when that hour is cleaner.
 *
 * Time away from home (weekday 09:00 to 17:00 for people who commute) is spent
 * indoors at work or school, where the home purifier and incense do not apply.
 */
export function calculateMemberExposure(
  member: HouseholdMember,
  profile: HouseholdProfile,
  hourlyData: HourlyAirQuality[],
  scenario: ExposureScenario = "normal"
): number {
  const day = describeDay(member, profile, hourlyData, scenario);
  let totalDose = 0;
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) totalDose += doseForHour(hour, day);
  return Math.round(totalDose * getSensitivityMultiplier(member));
}

/** Everything about one person's normal or optimised day that the hourly dose depends on. */
interface DayScenario {
  pmAt: (hour: number) => number;
  commutes: boolean;
  travelMode: CommuteMode;
  wearsN95: boolean;
  purifierRuns: boolean;
  burnsIncense: boolean;
  cookingFuel: HouseholdProfile["cookingFuel"];
  /** Share of one hour each commute leg takes. */
  legFraction: number;
  activityMinutes: Map<number, number>;
}

/** Work out the scenario once per person, so the hourly loop only does arithmetic. */
function describeDay(
  member: HouseholdMember,
  profile: HouseholdProfile,
  hourlyData: HourlyAirQuality[],
  scenario: ExposureScenario
): DayScenario {
  const isOptimized = scenario === "optimized";
  const byHour = indexByHour(hourlyData);
  const meanPm25 = meanOf(hourlyData.map((h) => h.pm25));
  const commutes = !staysAtHome(member.commuteMode);
  const commuteHours = Math.max(member.commuteTimeMinutes, 0) / MINUTES_PER_HOUR;
  return {
    pmAt: (hour) => byHour.get(hour)?.pm25 ?? meanPm25,
    commutes,
    travelMode: isOptimized ? recommendModeSwap(member.commuteMode) : member.commuteMode,
    wearsN95: isOptimized,
    purifierRuns: isOptimized || profile.hasAirPurifier,
    burnsIncense: !isOptimized && profile.usesIncenseOrCoils,
    cookingFuel: profile.cookingFuel,
    legFraction: commutes ? Math.min(commuteHours, DAY_MODEL.maxCommuteHoursPerLeg) : 0,
    activityMinutes: activityMinutesByHour(member.outdoorActivities, (activity) =>
      isOptimized ? shiftActivityHour(hourlyData, activity.preferredHour) : activity.preferredHour
    ),
  };
}

const COMMUTE_HOURS: readonly number[] = [
  DAY_MODEL.morningCommuteHour,
  DAY_MODEL.eveningCommuteHour,
];

/** People who commute are at work or school during the day, not at home. */
function isAtHome(hour: number, commutes: boolean): boolean {
  const away = DAY_MODEL.awayFromHome;
  return !(commutes && hour >= away.startHour && hour <= away.endHour);
}

/** Breathing rate indoors: resting at night, sitting during the day. */
function indoorBreathingRate(hour: number): number {
  return isSleepHour(hour)
    ? INHALATION_RATES_M3_PER_HOUR.resting
    : INHALATION_RATES_M3_PER_HOUR.sedentary_indoor;
}

/** PM2.5 inhaled in one hour: time at home or work, travelling, and outdoors. */
function doseForHour(hour: number, day: DayScenario): number {
  const outdoorPm25 = day.pmAt(hour);
  const atHome = isAtHome(hour, day.commutes);
  const indoorPm25 = computeIndoorPm25(outdoorPm25, {
    purifierRuns: day.purifierRuns && atHome,
    cookingFuel: day.cookingFuel,
    incenseBurning: day.burnsIncense && atHome && INCENSE_HOURS.includes(hour),
    isCookingHour: atHome && COOKING_HOURS.includes(hour),
  });

  const commuteFraction = COMMUTE_HOURS.includes(hour) ? day.legFraction : 0;
  const activityFraction = Math.min(
    (day.activityMinutes.get(hour) ?? 0) / MINUTES_PER_HOUR,
    1 - commuteFraction
  );
  const indoorFraction = 1 - commuteFraction - activityFraction;
  const indoorRate = indoorBreathingRate(hour);
  const travelPm25 =
    outdoorPm25 * COMMUTE_AMBIENT_FACTOR[day.travelMode] * (day.wearsN95 ? N95_PENETRATION : 1);

  return (
    indoorPm25 * indoorRate * indoorFraction +
    travelPm25 * COMMUTE_INHALATION_RATE[day.travelMode] * commuteFraction +
    outdoorPm25 * INHALATION_RATES_M3_PER_HOUR.walking * activityFraction
  );
}

/** The changes behind the optimised day, in plain words. Used when the model's own wording is missing. */
function describeChanges(
  member: HouseholdMember,
  profile: HouseholdProfile,
  hourly: HourlyAirQuality[]
): string[] {
  const changes: string[] = [];

  if (profile.usesIncenseOrCoils) {
    changes.push("Skip incense and mosquito coils indoors on smog days.");
  }
  if (!profile.hasAirPurifier) {
    changes.push(
      "Run a HEPA air purifier in the room where you spend most time, or keep one room sealed."
    );
  }
  if (member.smokes) {
    changes.push(
      "Skip smoking or vaping indoors, and cut down on smog days if you can. It adds fine particles on top of the smog, for you and for everyone at home."
    );
  }
  if (!staysAtHome(member.commuteMode)) {
    const target = recommendModeSwap(member.commuteMode);
    changes.push(
      target !== member.commuteMode
        ? `Switch from ${COMMUTE_MODE_LABELS[member.commuteMode]} to ${COMMUTE_MODE_LABELS[target]} and wear a fitted N95 mask.`
        : `Wear a fitted N95 mask on the ${COMMUTE_MODE_LABELS[member.commuteMode]} commute.`
    );
  }
  for (const activity of member.outdoorActivities) {
    const moved = shiftActivityHour(hourly, activity.preferredHour);
    changes.push(
      moved !== activity.preferredHour
        ? `Move "${activity.description}" from ${formatHour(activity.preferredHour)} to ${formatHour(moved)}, when the air is cleaner.`
        : `"${activity.description}" is already at one of the cleaner times of day. Keep it light.`
    );
  }

  if (changes.length === 0) {
    changes.push("Keep windows closed and avoid the evening rush hour outdoors.");
  }
  return changes;
}

/** Normal-day and optimised-day exposure for every member. */
export function calculateHouseholdExposureImpacts(
  profile: HouseholdProfile,
  hourlyData: HourlyAirQuality[]
): MemberExposureImpact[] {
  return profile.members.map((member) => {
    const baseline = calculateMemberExposure(member, profile, hourlyData, "normal");
    const optimized = calculateMemberExposure(member, profile, hourlyData, "optimized");
    const avoidedPercent = baseline > 0 ? Math.round(((baseline - optimized) / baseline) * 100) : 0;

    return {
      memberId: member.id,
      memberName: member.name,
      baselineExposureDose: baseline,
      optimizedExposureDose: optimized,
      exposureAvoidedPercentage: Math.max(0, Math.min(100, avoidedPercent)),
      keyChanges: describeChanges(member, profile, hourlyData),
    };
  });
}
