import { getAQICategory } from "./aqi";
import { averageAQI } from "./hourly";
import type { DayOutlook, HourlyAirQuality, OutlookLevel } from "./types";

/** How many days after today the outlook covers. */
export const OUTLOOK_DAYS = 3;
/** Waking hours used to judge a day (07:00 up to 21:00). */
const DAYTIME_START_HOUR = 7;
const DAYTIME_END_HOUR = 21;
/** A day needs at least this many daytime hours of data to be judged. */
const MIN_DAYTIME_HOURS = 8;
/** Length of the "cleanest time to go out" window, in hours. */
const WINDOW_HOURS = 2;
/** Daytime averages up to this AQI count as a good day; above the second limit, stay in. */
const GOOD_DAY_MAX_AQI = 100;
const CAREFUL_DAY_MAX_AQI = 200;

/** The level for a daytime average AQI. */
export function outlookLevel(aqi: number): OutlookLevel {
  if (aqi <= GOOD_DAY_MAX_AQI) return "good";
  if (aqi <= CAREFUL_DAY_MAX_AQI) return "careful";
  return "avoid";
}

function isDaytime(hour: number): boolean {
  return hour >= DAYTIME_START_HOUR && hour < DAYTIME_END_HOUR;
}

/**
 * The cleanest run of consecutive daytime hours in one day. A day is only
 * judged with at least 8 of its 14 waking hours, so two hours in a row always
 * exist; the cleanest single hour is the fallback all the same.
 */
function cleanestWindow(daytime: readonly HourlyAirQuality[]): DayOutlook["bestWindow"] {
  const byHour = new Map(daytime.map((h) => [h.hour, h]));
  const cleanestHour = daytime.reduce((a, b) => (b.aqi < a.aqi ? b : a));
  let best: DayOutlook["bestWindow"] = {
    startHour: cleanestHour.hour,
    endHour: cleanestHour.hour + 1,
    averageAQI: cleanestHour.aqi,
  };
  for (const start of daytime) {
    const run = Array.from({ length: WINDOW_HOURS }, (_, i) => byHour.get(start.hour + i));
    if (run.some((h) => !h || !isDaytime(h.hour))) continue;
    const average = averageAQI(run as HourlyAirQuality[]);
    if (best.endHour - best.startHour < WINDOW_HOURS || average < best.averageAQI) {
      best = { startHour: start.hour, endHour: start.hour + WINDOW_HOURS, averageAQI: average };
    }
  }
  return best;
}

/** One day's outlook, or null when there is too little daytime data. */
function describeDay(date: string, hours: readonly HourlyAirQuality[]): DayOutlook | null {
  const daytime = hours.filter((h) => isDaytime(h.hour));
  if (daytime.length < MIN_DAYTIME_HOURS) return null;
  const average = averageAQI(daytime);
  return {
    date,
    averageAQI: average,
    category: getAQICategory(average),
    peakAQI: Math.max(...daytime.map((h) => h.aqi)),
    level: outlookLevel(average),
    bestWindow: cleanestWindow(daytime),
    isBestDay: false,
  };
}

/**
 * The next few days after `today`, judged on their waking hours. Days with
 * too little data are left out rather than guessed. The cleanest day is
 * marked when there is more than one day to compare.
 */
export function buildOutlook(
  forecast: readonly HourlyAirQuality[],
  today: string | undefined
): DayOutlook[] {
  if (!today) return [];
  const byDate = new Map<string, HourlyAirQuality[]>();
  for (const entry of forecast) {
    const date = entry.time.slice(0, 10);
    if (date <= today) continue;
    byDate.set(date, [...(byDate.get(date) ?? []), entry]);
  }

  const days = [...byDate.keys()]
    .sort()
    .map((date) => describeDay(date, byDate.get(date) ?? []))
    .filter((day): day is DayOutlook => day !== null)
    .slice(0, OUTLOOK_DAYS);

  if (days.length > 1) {
    const cleanest = days.reduce((a, b) => (b.averageAQI < a.averageAQI ? b : a));
    cleanest.isBestDay = true;
  }
  return days;
}
