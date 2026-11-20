import { calculateAQI } from "./aqi";
import { COMMUTE_AMBIENT_FACTOR, INFILTRATION_FACTORS, N95_PENETRATION } from "./factors";
import { HourlyAirQuality, ScheduleActionType } from "./types";

/**
 * Fraction of the outdoor particle level a person still breathes after an
 * action, or null for actions that work by moving in time.
 *
 * - mode_swap: enclosed transit plus a fitted N95
 * - indoor_protection: windows closed, plus the purifier when the home has one
 * - purifier_timing: closed windows with the purifier running
 */
export function protectionFactor(action: ScheduleActionType, hasPurifier: boolean): number | null {
  switch (action) {
    case "mode_swap":
      return COMMUTE_AMBIENT_FACTOR.metro * N95_PENETRATION;
    case "indoor_protection":
      return (
        INFILTRATION_FACTORS.standard_closed_windows *
        (hasPurifier ? INFILTRATION_FACTORS.with_hepa_purifier : 1)
      );
    case "purifier_timing":
      return INFILTRATION_FACTORS.standard_closed_windows * INFILTRATION_FACTORS.with_hepa_purifier;
    case "schedule_shift":
      return null;
  }
}

/**
 * The AQI a person effectively experiences after following an action.
 *
 * For schedule_shift the activity moves to `shiftedTo` (the cleanest exercise
 * hour). If that hour is not cleaner, or there is no such hour, the activity is
 * treated as moved indoors with windows closed.
 */
export function effectiveAQI(
  action: ScheduleActionType,
  outdoor: HourlyAirQuality,
  options: { hasPurifier: boolean; shiftedTo?: HourlyAirQuality | null }
): number {
  const factor = protectionFactor(action, options.hasPurifier);

  if (factor === null) {
    const target = options.shiftedTo;
    if (target && target.aqi < outdoor.aqi) return target.aqi;
    return scaleAQI(outdoor, INFILTRATION_FACTORS.standard_closed_windows);
  }

  return scaleAQI(outdoor, factor);
}

function scaleAQI(entry: HourlyAirQuality, factor: number): number {
  return calculateAQI(entry.pm25 * factor, entry.pm10 * factor).aqi;
}
