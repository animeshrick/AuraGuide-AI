import { HourlyAirQuality } from "./types";

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

export function aqiAtHour(
  hourly: readonly HourlyAirQuality[],
  hour: number,
  fallback: number
): number {
  return indexByHour(hourly).get(hour)?.aqi ?? fallback;
}

export function meanOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function averageAQI(hours: readonly { aqi: number }[]): number {
  return Math.round(meanOf(hours.map((h) => h.aqi)));
}
