import { getAQICategory } from "./aqi";
import { getSensitivityMultiplier } from "./exposure";
import { indexByHour, meanOf } from "./hourly";
import type { AQICategory, CommuteMode, HourlyAirQuality, HouseholdMember } from "./types";

/** How a person will travel, grouped by how much of the outside air they breathe. */
export type OutingMode = "on_foot" | "open_vehicle" | "closed_vehicle";
/** Roughly how long the person will be out. Only a long outing adds a step. */
export type OutingDuration = "short" | "medium" | "long";
/** The verdict for going out: fine, go with care, or better avoided. */
export type OutingLevel = "fine" | "careful" | "avoid";

/** One precaution. The wording for each id lives in the translation files. */
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
/** Up to this age a child is treated as an infant, whatever the profile says. */
const INFANT_MAX_AGE = 2;
/** From this age a person is treated as elderly, whatever the profile says. */
const ELDERLY_MIN_AGE = 60;
/** A cleaner hour is mentioned only when it is at least this many AQI points lower... */
const MIN_FELT_AQI_DROP = 20;
/** ...and at most this share of the AQI at the chosen hour (15% lower or more). */
const MAX_CLEANER_SHARE = 0.85;

/** AQI categories as a 0 to 5 scale, so a sensitive person can be moved one band stricter. */
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

/** The air at one hour of the day. */
interface OutingHour {
  hour: number;
  aqi: number;
  category: AQICategory;
}

/** Everything the outing panel shows for one person, one hour and one way of travelling. */
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

/** The air at `hour`, falling back to the day's average when that hour has no reading. */
function hourEntry(hourly: readonly HourlyAirQuality[], hour: number): OutingHour | null {
  const found = indexByHour(hourly).get(hour);
  if (found) return { hour, aqi: found.aqi, category: found.category };
  if (hourly.length === 0) return null;
  const aqi = Math.round(meanOf(hourly.map((h) => h.aqi)));
  return { hour, aqi, category: getAQICategory(aqi) };
}

/** True when `next` is a better cleaner-hour pick than `best`: cleaner air, or as clean and sooner. */
function isBetterPick(
  next: { aqi: number; distance: number },
  best: { aqi: number; distance: number } | null
): boolean {
  if (!best) return true;
  return next.aqi < best.aqi || (next.aqi === best.aqi && next.distance < best.distance);
}

/** Waking hours within a few hours either side of `hour`, earliest first, with their distance. */
function nearbyWakingHours(hour: number): { hour: number; distance: number }[] {
  const hours: { hour: number; distance: number }[] = [];
  for (let offset = -SEARCH_HOURS; offset <= SEARCH_HOURS; offset++) {
    const candidate = (hour + offset + 24) % 24;
    const waking = candidate >= WAKING_HOURS.first && candidate <= WAKING_HOURS.last;
    if (offset !== 0 && waking) hours.push({ hour: candidate, distance: Math.abs(offset) });
  }
  return hours;
}

/** A clearly cleaner hour nearby, worth mentioning only when the difference would be felt. */
function findCleanerHour(
  hourly: readonly HourlyAirQuality[],
  hour: number,
  aqi: number
): OutingHour | null {
  const byHour = indexByHour(hourly);
  let best: (OutingHour & { distance: number }) | null = null;
  for (const { hour: candidate, distance } of nearbyWakingHours(hour)) {
    const entry = byHour.get(candidate);
    if (entry && isBetterPick({ aqi: entry.aqi, distance }, best)) {
      best = { hour: candidate, aqi: entry.aqi, category: entry.category, distance };
    }
  }
  const feltDifference =
    best !== null && aqi - best.aqi >= MIN_FELT_AQI_DROP && best.aqi <= aqi * MAX_CLEANER_SHARE;
  return best && feltDifference
    ? { hour: best.hour, aqi: best.aqi, category: best.category }
    : null;
}

/** The parts of a person's profile that change the advice. */
interface PersonRisk {
  has: (sensitivity: HouseholdMember["sensitivities"][number]) => boolean;
  infant: boolean;
  elderly: boolean;
  sensitive: boolean;
}

/** What about this person makes them more vulnerable outdoors. */
function personRisk(member: HouseholdMember): PersonRisk {
  const has = (s: HouseholdMember["sensitivities"][number]) => member.sensitivities.includes(s);
  const infant = has("infant") || member.age <= INFANT_MAX_AGE;
  const elderly = has("elderly") || member.age >= ELDERLY_MIN_AGE;
  const sensitive = infant || elderly || getSensitivityMultiplier(member) >= SENSITIVE_MULTIPLIER;
  return { has, infant, elderly, sensitive };
}

/** The verdict for an effective band: up to 2 fine, 3 careful, 4 or more avoid. */
function levelFor(effectiveBand: number): OutingLevel {
  if (effectiveBand <= 2) return "fine";
  if (effectiveBand === 3) return "careful";
  return "avoid";
}

/** Breathing protection. Infants are kept indoors instead of masked. */
function breathingSteps(risk: PersonRisk, effectiveBand: number, notable: boolean): PrecautionId[] {
  if (risk.infant) return notable ? ["infant_indoors"] : [];
  if (effectiveBand >= 3) return ["n95"];
  return notable ? ["mask_optional"] : [];
}

/** Steps for the person's own health conditions. */
function healthSteps(risk: PersonRisk): PrecautionId[] {
  const steps: PrecautionId[] = [];
  if (risk.has("asthma")) steps.push("inhaler");
  if (risk.has("cardiac")) steps.push("heart_slow");
  if (risk.elderly) steps.push("elderly_company");
  if (risk.has("pregnant")) steps.push("pregnant_short");
  return steps;
}

/** The one step that depends on how the person travels. */
const MODE_STEPS: Record<OutingMode, PrecautionId> = {
  on_foot: "walk_slow",
  open_vehicle: "helmet_mask",
  closed_vehicle: "recirculate",
};

/** Steps that depend on how, when and for how long the person travels. */
function tripSteps(mode: OutingMode, hour: number, duration: OutingDuration): PrecautionId[] {
  const steps: PrecautionId[] = [MODE_STEPS[mode]];
  if (mode !== "closed_vehicle" && RUSH_HOURS.includes(hour)) steps.push("quiet_road");
  if (duration === "long") steps.push("break_indoors");
  steps.push("after_wash");
  return steps;
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

  const risk = personRisk(member);
  const band = BAND[now.category];
  const effectiveBand = Math.min(5, band + (risk.sensitive ? 1 : 0));
  const level = levelFor(effectiveBand);
  const notable = band >= BAND.Moderate;

  const steps: PrecautionId[] = [
    ...(level === "avoid" ? (["postpone"] as const) : []),
    ...breathingSteps(risk, effectiveBand, notable),
    ...(notable ? [...healthSteps(risk), ...tripSteps(mode, hour, duration)] : []),
  ];

  return {
    hour,
    aqi: now.aqi,
    category: now.category,
    level,
    stricter: risk.sensitive && notable,
    cleaner: findCleanerHour(hourly, hour, now.aqi),
    // The closing safety step is always kept, however long the list is.
    precautions: [...steps.slice(0, MAX_STEPS), "symptoms"],
  };
}
