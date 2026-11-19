import { calculateAQI } from "@/domain/aqi";
import type {
  CurrentAirQuality,
  HourlyAirQuality,
  HouseholdMember,
  HouseholdProfile,
} from "@/domain/types";

/** Local midnight of the test day, written as UTC so tests do not depend on the machine's time zone. */
const DAY_START_MS = Date.UTC(2026, 10, 19, 0, 0);

/** A typical smog day: bad mornings and evenings, cleaner in the afternoon. */
export function smogPm25(hour: number): number {
  if (hour >= 6 && hour <= 10) return 220;
  if (hour >= 17 && hour <= 22) return 200;
  if (hour >= 12 && hour <= 16) return 60;
  return 120;
}

export function makeHourly(
  startHour = 6,
  count = 24,
  pm25At: (hour: number) => number = smogPm25
): HourlyAirQuality[] {
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(DAY_START_MS + (startHour + i) * 3_600_000);
    const hour = at.getUTCHours();
    const pm25 = pm25At(hour);
    const pm10 = Math.round(pm25 * 1.6);
    const { aqi, category } = calculateAQI(pm25, pm10);
    return { time: at.toISOString().slice(0, 16), hour, pm25, pm10, aqi, category };
  });
}

export function makeAirQuality(
  overrides: Partial<CurrentAirQuality> = {}
): CurrentAirQuality {
  const hourly = overrides.hourly ?? makeHourly();
  const first = hourly[0];
  const { primaryPollutant } = calculateAQI(first.pm25, first.pm10);
  return {
    city: "New Delhi",
    latitude: 28.61,
    longitude: 77.21,
    aqi: first.aqi,
    pm25: first.pm25,
    pm10: first.pm10,
    category: first.category,
    primaryPollutant,
    updatedAt: "2026-11-19T00:30:00.000Z",
    dataSource: "open-meteo",
    ...overrides,
    hourly,
  };
}

export function makeMember(overrides: Partial<HouseholdMember> = {}): HouseholdMember {
  return {
    id: "m1",
    name: "Rajesh",
    age: 40,
    sensitivities: ["none"],
    commuteMode: "car_ice",
    commuteDistanceKm: 14,
    commuteTimeMinutes: 45,
    outdoorActivities: [],
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<HouseholdProfile> = {}): HouseholdProfile {
  return {
    city: "New Delhi",
    cookingFuel: "lpg",
    usesIncenseOrCoils: true,
    hasAirPurifier: false,
    language: "en",
    members: [
      makeMember(),
      makeMember({
        id: "m2",
        name: "Sunita",
        age: 38,
        sensitivities: ["asthma"],
        commuteMode: "auto_rickshaw",
        commuteDistanceKm: 6,
        commuteTimeMinutes: 25,
        outdoorActivities: [{ description: "Morning yoga", preferredHour: 7, durationMinutes: 30 }],
      }),
      makeMember({
        id: "m3",
        name: "Aarav",
        age: 2,
        sensitivities: ["infant"],
        commuteMode: "work_from_home",
        commuteDistanceKm: 0,
        commuteTimeMinutes: 0,
        outdoorActivities: [{ description: "Park play", preferredHour: 10, durationMinutes: 45 }],
      }),
    ],
    ...overrides,
  };
}
