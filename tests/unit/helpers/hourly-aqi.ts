import { getAQICategory } from "@/domain/aqi";
import type { HourlyAirQuality } from "@/domain/types";

/** A 24-hour forecast with the AQI chosen for each hour, so a test can state the air exactly. */
export function hourlyFrom(aqiAt: (hour: number) => number): HourlyAirQuality[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const aqi = aqiAt(hour);
    return {
      time: `2026-11-19T${String(hour).padStart(2, "0")}:00`,
      hour,
      pm25: 0,
      pm10: 0,
      aqi,
      category: getAQICategory(aqi),
    };
  });
}

/** The same AQI all day. */
export const flatDay = (aqi: number) => hourlyFrom(() => aqi);
