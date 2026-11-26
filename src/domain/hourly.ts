import type { HourlyAirQuality } from "./types";

/**
 * Index a rolling 24-hour forecast by local hour of day. If an hour appears
 * twice, the first (nearest in time) entry wins.
 */
export function indexByHour(hourly: readonly HourlyAirQuality[]): Map<number, HourlyAirQuality> {
  const map = new Map<number, HourlyAirQuality>();
  for (const entry of hourly) {
    if (!map.has(entry.hour)) map.set(entry.hour, entry);
  }
  return map;
}

/** Average of a list, or 0 for an empty list. */
export function meanOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Rounded average AQI of some hours. */
export function averageAQI(hours: readonly { aqi: number }[]): number {
  return Math.round(meanOf(hours.map((h) => h.aqi)));
}
