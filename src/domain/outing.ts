import { getAQICategory } from "./aqi";
import { getSensitivityMultiplier } from "./exposure";
import { indexByHour, meanOf } from "./hourly";
import { AQICategory, CommuteMode, HourlyAirQuality, HouseholdMember } from "./types";

/** How a person will travel, grouped by how much of the outside air they breathe. */
export type OutingMode = "on_foot" | "open_vehicle" | "closed_vehicle";
export type OutingDuration = "short" | "medium" | "long";
export type OutingLevel = "fine" | "careful" | "avoid";

export type PrecautionId =
  | "postpone"
  | "n95"
  | "mask_optional"
  | "infant_indoors"
  | "inhaler"
  | "heart_slow"
  | "elderly_company"
  | "pregnant_short"
  | "walk_slow"
  | "helmet_mask"
  | "recirculate"
  | "quiet_road"
  | "break_indoors"
  | "after_wash"
  | "symptoms";

export const OUTING_MODES: readonly OutingMode[] = ["on_foot", "open_vehicle", "closed_vehicle"];
export const OUTING_DURATIONS: readonly OutingDuration[] = ["short", "medium", "long"];

/** Hours when most people are awake. A cleaner time is only suggested inside them. */
const WAKING_HOURS = { first: 6, last: 21 };
/** Rush hours, when traffic fumes on main roads are highest. */
const RUSH_HOURS = [8, 9, 10, 17, 18, 19, 20];
/** How far from the chosen hour a cleaner time is looked for. */
const SEARCH_HOURS = 3;
/** Most steps shown before the closing safety step, so the list stays short enough to read. */
const MAX_STEPS = 6;
/** A multiplier at or above this means the person is more sensitive to dirty air. */
const SENSITIVE_MULTIPLIER = 1.5;

const BAND: Record<AQICategory, number> = {
  Good: 0,
  Satisfactory: 1,
  Moderate: 2,
  Poor: 3,
  "Very Poor": 4,
  Severe: 5,
};

/** The usual way of going out for someone, from how they normally travel. */
export function outingModeFor(commute: CommuteMode): OutingMode {
  switch (commute) {
    case "two_wheeler":
    case "auto_rickshaw":
      return "open_vehicle";
    case "bus":
    case "metro":
    case "car_ice":
    case "car_ev":
      return "closed_vehicle";
    default:
      return "on_foot";
  }
}

interface OutingHour {
  hour: number;
  aqi: number;
  category: AQICategory;
}

export interface OutingAdvice {
  hour: number;
  aqi: number;
  category: AQICategory;
  level: OutingLevel;
  /** True when the advice is stricter because of the person's age or health. */
  stricter: boolean;
  /** A noticeably cleaner time within a few hours, when there is one. */
  cleaner: OutingHour | null;
  precautions: PrecautionId[];
}

function hourEntry(hourly: readonly HourlyAirQuality[], hour: number): OutingHour | null {
  const found = indexByHour(hourly).get(hour);
  if (found) return { hour, aqi: found.aqi, category: found.category };
  if (hourly.length === 0) return null;
  const aqi = Math.round(meanOf(hourly.map((h) => h.aqi)));
  return { hour, aqi, category: getAQICategory(aqi) };
}

function findCleanerHour(
  hourly: readonly HourlyAirQuality[],
  hour: number,
  aqi: number
): OutingHour | null {
  let best: { entry: OutingHour; distance: number } | null = null;

  for (let offset = -SEARCH_HOURS; offset <= SEARCH_HOURS; offset++) {
    if (offset === 0) continue;
    const candidate = (hour + offset + 24) % 24;
    if (candidate < WAKING_HOURS.first || candidate > WAKING_HOURS.last) continue;

    const entry = indexByHour(hourly).get(candidate);
    if (!entry) continue;
    const distance = Math.abs(offset);
    if (
      !best ||
      entry.aqi < best.entry.aqi ||
      (entry.aqi === best.entry.aqi && distance < best.distance)
    ) {
      best = { entry: { hour: candidate, aqi: entry.aqi, category: entry.category }, distance };
    }
  }

  // Only worth mentioning when the difference would be felt.
  if (best && aqi - best.entry.aqi >= 20 && best.entry.aqi <= aqi * 0.85) return best.entry;
  return null;
}

/**
 * Precautions for one person going out at one hour.
 *
 * The air quality at that hour sets the level. A more sensitive person (infant, elderly, asthma,
 * heart condition, pregnancy, outdoor work) is held to a stricter level, one band worse. The steps
 * then follow from the level, the person's health, how they travel, the time of day and how long
 * they will be out. A mask is never advised for an infant.
 */
export function planOuting(args: {
  member: HouseholdMember;
  hourly: readonly HourlyAirQuality[];
  hour: number;
  duration: OutingDuration;
  mode: OutingMode;
}): OutingAdvice | null {
  const { member, hourly, hour, duration, mode } = args;
  const now = hourEntry(hourly, hour);
  if (!now) return null;

  const has = (s: HouseholdMember["sensitivities"][number]) => member.sensitivities.includes(s);
  const infant = has("infant") || member.age <= 2;
  const elderly = has("elderly") || member.age >= 60;
  const sensitive = infant || elderly || getSensitivityMultiplier(member) >= SENSITIVE_MULTIPLIER;

  const band = BAND[now.category];
  const effective = Math.min(5, band + (sensitive ? 1 : 0));
  const level: OutingLevel = effective <= 2 ? "fine" : effective === 3 ? "careful" : "avoid";
  const notable = band >= BAND.Moderate;

  const steps: PrecautionId[] = [];
  if (level === "avoid") steps.push("postpone");

  if (infant) {
    if (notable) steps.push("infant_indoors");
  } else if (effective >= 3) {
    steps.push("n95");
  } else if (notable) {
    steps.push("mask_optional");
  }

  if (notable) {
    if (has("asthma")) steps.push("inhaler");
    if (has("cardiac")) steps.push("heart_slow");
    if (elderly) steps.push("elderly_company");
    if (has("pregnant")) steps.push("pregnant_short");

    if (mode === "on_foot") steps.push("walk_slow");
    if (mode === "open_vehicle") steps.push("helmet_mask");
    if (mode === "closed_vehicle") steps.push("recirculate");
    if (mode !== "closed_vehicle" && RUSH_HOURS.includes(hour)) steps.push("quiet_road");
    if (duration === "long") steps.push("break_indoors");
    steps.push("after_wash");
  }

  return {
    hour,
    aqi: now.aqi,
    category: now.category,
    level,
    stricter: sensitive && notable,
    cleaner: findCleanerHour(hourly, hour, now.aqi),
    // The closing safety step is always kept, however long the list is.
    precautions: [...steps.slice(0, MAX_STEPS), "symptoms"],
  };
}
