import { getAQICategory } from "./aqi";
import { averageAQI, indexByHour, meanOf } from "./hourly";
import { formatHourRange } from "./labels";
import { AQICategory, HourlyAirQuality, SafeWindow } from "./types";

interface Block {
  startHour: number;
  endHour: number;
  averageAQI: number;
  category: AQICategory;
}

/**
 * Where each activity can sensibly happen and for how long. Searching inside a
 * range keeps recommendations realistic (no jogging at 3 am because the air is
 * clean then).
 */
export const WINDOW_RULES = {
  school_run: { fromHour: 6, toHour: 10, lengthHours: 2 },
  exercise: { fromHour: 8, toHour: 19, lengthHours: 1 },
  ventilation: { fromHour: 9, toHour: 18, lengthHours: 2 },
} as const;

/**
 * Find the run of consecutive hours with the lowest average AQI inside
 * [fromHour, toHour). Returns null when the data does not cover any complete run.
 * Ties go to the earliest start.
 */
export function findBestBlock(
  hourly: readonly HourlyAirQuality[],
  fromHour: number,
  toHour: number,
  lengthHours: number
): Block | null {
  const byHour = indexByHour(hourly);
  let best: { block: Block; mean: number } | null = null;

  for (let start = fromHour; start + lengthHours <= toHour; start++) {
    const entries: HourlyAirQuality[] = [];
    for (let k = 0; k < lengthHours; k++) {
      const entry = byHour.get(start + k);
      if (!entry) break;
      entries.push(entry);
    }
    if (entries.length !== lengthHours) continue;

    const mean = meanOf(entries.map((e) => e.aqi));
    if (best === null || mean < best.mean) {
      const rounded = averageAQI(entries);
      best = {
        mean,
        block: {
          startHour: start,
          endHour: start + lengthHours,
          averageAQI: rounded,
          category: getAQICategory(rounded),
        },
      };
    }
  }

  return best ? best.block : null;
}

/** Start hour of the cleanest one-hour slot for outdoor exercise, or null without data. */
export function bestExerciseStartHour(hourly: readonly HourlyAirQuality[]): number | null {
  const { fromHour, toHour, lengthHours } = WINDOW_RULES.exercise;
  return findBestBlock(hourly, fromHour, toHour, lengthHours)?.startHour ?? null;
}

/**
 * Where an outdoor activity that normally starts at `preferredHour` should move.
 * It only moves if the cleanest exercise hour has strictly lower PM2.5.
 */
export function shiftActivityHour(
  hourly: readonly HourlyAirQuality[],
  preferredHour: number
): number {
  const best = bestExerciseStartHour(hourly);
  if (best === null) return preferredHour;
  const byHour = indexByHour(hourly);
  const bestEntry = byHour.get(best);
  const preferredEntry = byHour.get(preferredHour);
  if (!bestEntry || !preferredEntry) return preferredHour;
  return bestEntry.pm25 < preferredEntry.pm25 ? best : preferredHour;
}

type Band = "clean" | "elevated" | "high" | "severe";

function bandFor(aqi: number): Band {
  if (aqi <= 100) return "clean";
  if (aqi <= 200) return "elevated";
  if (aqi <= 300) return "high";
  return "severe";
}

const RECOMMENDATIONS: Record<SafeWindow["activity"], (range: string) => Record<Band, string>> = {
  school_run: (range) => ({
    clean: `Air is fine for the school run. ${range} is the cleanest slot to leave.`,
    elevated: `Leave in the ${range} slot, the cleanest of the morning. Keep waiting time outdoors short.`,
    high: `Leave in the ${range} slot if the school allows it. Use an enclosed vehicle and a fitted N95 for each child.`,
    severe: `Morning air is very unhealthy even in the best slot (${range}). Use an enclosed vehicle with windows up and a fitted N95 for each child.`,
  }),
  exercise: (range) => ({
    clean: `${range} is the best hour for a brisk walk or outdoor play.`,
    elevated: `${range} is the cleanest hour for outdoor activity. Keep it light and short.`,
    high: `Even the best hour (${range}) is unhealthy. Prefer indoor exercise, or keep outdoor activity to a slow walk with an N95.`,
    severe: `Outdoor exercise is not advised today, even at ${range}. Exercise indoors.`,
  }),
  ventilation: (range) => ({
    clean: `Open windows for fresh air around ${range}.`,
    elevated: `Open windows briefly around ${range}, when the air is cleanest, then close them again.`,
    high: `Open windows for no more than 10 to 15 minutes around ${range}. Keep them shut the rest of the day.`,
    severe: `Outdoor air stays very unhealthy all day. Keep windows closed, even around ${range}, and rely on a purifier or a sealed room.`,
  }),
  general_outdoor: (range) => ({
    clean: `${range} is a good time for outdoor errands.`,
    elevated: `${range} is the cleanest time for outdoor errands.`,
    high: `Limit outdoor errands to ${range}.`,
    severe: `Avoid outdoor errands. If you must go out, use ${range} and wear an N95.`,
  }),
};

/**
 * Cleanest slots for the school run, outdoor exercise and airing the home.
 * Returns an empty list when there is no hourly data, so the app never shows
 * invented numbers.
 */
export function findSafeWindows(hourly: readonly HourlyAirQuality[]): SafeWindow[] {
  if (!hourly || hourly.length === 0) return [];

  const windows: SafeWindow[] = [];
  const activities = ["school_run", "exercise", "ventilation"] as const;

  for (const activity of activities) {
    const rule = WINDOW_RULES[activity];
    const block = findBestBlock(hourly, rule.fromHour, rule.toHour, rule.lengthHours);
    if (!block) continue;
    const range = formatHourRange(block.startHour, block.endHour);
    windows.push({
      activity,
      startHour: block.startHour,
      endHour: block.endHour,
      averageAQI: block.averageAQI,
      category: block.category,
      recommendation: RECOMMENDATIONS[activity](range)[bandFor(block.averageAQI)],
    });
  }

  return windows;
}
