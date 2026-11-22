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
import {
  CommuteMode,
  HourlyAirQuality,
  HouseholdMember,
  HouseholdProfile,
  MemberExposureImpact,
  OutdoorActivity,
} from "./types";
import { shiftActivityHour } from "./windows";

const COOKING_HOURS: readonly number[] = DAY_MODEL.cookingHours;
const INCENSE_HOURS: readonly number[] = DAY_MODEL.incenseHours;

/**
 * PM2.5 inside the home for one hour.
 * `usesIncense` means incense or coils are burning during this hour.
 */
export function computeIndoorPm25(
  outdoorPm25: number,
  hasPurifier: boolean,
  cookingFuel: HouseholdProfile["cookingFuel"],
  usesIncense: boolean,
  isCookingHour: boolean = false
): number {
  let indoor = outdoorPm25 * INFILTRATION_FACTORS.standard_closed_windows;

  if (isCookingHour && cookingFuel === "biomass") {
    indoor += INFILTRATION_FACTORS.biomass_indoor_added_pm;
  }
  if (usesIncense) {
    indoor += INFILTRATION_FACTORS.incense_coil_added_pm;
  }
  if (hasPurifier) {
    indoor = indoor * INFILTRATION_FACTORS.with_hepa_purifier;
  }

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
    for (let step = 0; remaining > 0 && step < 24; step++) {
      const slice = Math.min(60, remaining);
      const key = hour % 24;
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
  isOptimized: boolean = false
): number {
  const byHour = indexByHour(hourlyData);
  const meanPm25 = meanOf(hourlyData.map((h) => h.pm25));
  const pmAt = (hour: number) => byHour.get(hour)?.pm25 ?? meanPm25;

  const commutes = !staysAtHome(member.commuteMode);
  const travelMode: CommuteMode = isOptimized
    ? recommendModeSwap(member.commuteMode)
    : member.commuteMode;
  const purifierRuns = isOptimized || profile.hasAirPurifier;
  const burnsIncense = !isOptimized && profile.usesIncenseOrCoils;
  const legFraction = commutes
    ? Math.min(Math.max(member.commuteTimeMinutes, 0) / 60, DAY_MODEL.maxCommuteHoursPerLeg)
    : 0;
  const commuteHours: number[] = [DAY_MODEL.morningCommuteHour, DAY_MODEL.eveningCommuteHour];
  const away = DAY_MODEL.awayFromHome;

  const activityMinutes = activityMinutesByHour(member.outdoorActivities, (activity) =>
    isOptimized ? shiftActivityHour(hourlyData, activity.preferredHour) : activity.preferredHour
  );

  let totalDose = 0;

  for (let hour = 0; hour < 24; hour++) {
    const outdoorPm25 = pmAt(hour);
    const atHome = !(commutes && hour >= away.startHour && hour <= away.endHour);

    const indoorPm25 = computeIndoorPm25(
      outdoorPm25,
      purifierRuns && atHome,
      profile.cookingFuel,
      burnsIncense && atHome && INCENSE_HOURS.includes(hour),
      atHome && COOKING_HOURS.includes(hour)
    );

    const commuteFraction = commuteHours.includes(hour) ? legFraction : 0;
    const activityFraction = Math.min((activityMinutes.get(hour) ?? 0) / 60, 1 - commuteFraction);
    const indoorFraction = 1 - commuteFraction - activityFraction;

    const indoorRate = isSleepHour(hour)
      ? INHALATION_RATES_M3_PER_HOUR.resting
      : INHALATION_RATES_M3_PER_HOUR.sedentary_indoor;

    let travelPm25 = outdoorPm25 * COMMUTE_AMBIENT_FACTOR[travelMode];
    if (isOptimized) travelPm25 *= N95_PENETRATION;

    totalDose +=
      indoorPm25 * indoorRate * indoorFraction +
      travelPm25 * COMMUTE_INHALATION_RATE[travelMode] * commuteFraction +
      outdoorPm25 * INHALATION_RATES_M3_PER_HOUR.walking * activityFraction;
  }

  return Math.round(totalDose * getSensitivityMultiplier(member));
}

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
    const baseline = calculateMemberExposure(member, profile, hourlyData, false);
    const optimized = calculateMemberExposure(member, profile, hourlyData, true);
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
