import { calculateAQI } from "@/domain/aqi";
import type { CurrentAirQuality, HourlyAirQuality } from "@/domain/types";
import { aqiCache } from "./cache";

const FETCH_TIMEOUT_MS = 8_000;
/** Fewer usable hours than this and the forecast is treated as unavailable. */
const MIN_USABLE_HOURS = 12;
const HOURS_TO_KEEP = 24;
/** Today plus the three days shown in the outlook. */
const FORECAST_DAYS = 4;
/** The modelled fallback assumes India Standard Time (UTC+5:30). */
const MODELLED_UTC_OFFSET_SECONDS = 19_800;
const MODELLED_CACHE_MS = 60 * 1000;
const LIVE_CACHE_MS = 30 * 60 * 1000;
const GEOCODE_CACHE_MS = 24 * 60 * 60 * 1000;

const HEADERS = { "User-Agent": "AuraGuide-AI/1.0" };
const MS_PER_HOUR = 3_600_000;

/** PM2.5 (µg/m³) for the hours of the modelled day that fall outside the periods below. */
const MODELLED_BASE_PM25 = 140;
/** The modelled day: a morning peak, a cleaner afternoon and a late-evening peak. Hours are inclusive. */
const MODELLED_PM25_PERIODS = [
  { fromHour: 6, toHour: 9, pm25: 260 },
  { fromHour: 13, toHour: 16, pm25: 90 },
  { fromHour: 20, toHour: 23, pm25: 220 },
] as const;
/** In winter smog, PM10 runs at roughly 1.6 times PM2.5. */
const MODELLED_PM10_RATIO = 1.6;

type GeocodeResult =
  | { status: "ok"; name: string; latitude: number; longitude: number }
  | { status: "not_found" }
  | { status: "unavailable" };

interface GeocodingResponse {
  results?: { name: string; latitude: number; longitude: number }[];
}

export interface OpenMeteoAirQualityResponse {
  utc_offset_seconds?: number;
  hourly?: {
    time?: string[];
    pm10?: (number | null)[];
    pm2_5?: (number | null)[];
  };
}

/** One GET request to Open-Meteo, given up on after a few seconds so a slow service cannot hold a request open. */
function openMeteoGet(url: string): Promise<Response> {
  return fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

/** Look a city up. "not_found" and "unavailable" are kept apart so the app can tell a typo from an outage. */
export async function geocodeCity(city: string): Promise<GeocodeResult> {
  const cacheKey = `geo:${city.toLowerCase().trim()}`;
  const cached = aqiCache.get<Extract<GeocodeResult, { status: "ok" }>>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city.trim()
    )}&count=1&language=en&format=json`;
    const res = await openMeteoGet(url);
    if (!res.ok) return { status: "unavailable" };

    const data: GeocodingResponse = await res.json();
    const item = data.results?.[0];
    if (!item) return { status: "not_found" };

    const result = {
      status: "ok" as const,
      name: item.name,
      latitude: item.latitude,
      longitude: item.longitude,
    };
    aqiCache.set(cacheKey, result, GEOCODE_CACHE_MS);
    return result;
  } catch (err) {
    console.error("Geocoding request failed:", err instanceof Error ? err.message : "unknown");
    return { status: "unavailable" };
  }
}

/** A finite reading from one series, or null when the value is missing or not a number. */
function readingAt(series: readonly (number | null)[], index: number): number | null {
  const value = series[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** One forecast hour, or null when neither PM2.5 nor PM10 has a reading. */
function toHourEntry(
  time: string,
  pm25: number | null,
  pm10: number | null
): HourlyAirQuality | null {
  if (pm25 === null && pm10 === null) return null;
  const p25 = pm25 ?? 0;
  const p10 = pm10 ?? 0;
  const { aqi, category } = calculateAQI(p25, p10);
  return {
    time,
    hour: parseInt(time.slice(11, 13), 10),
    pm25: Math.round(p25),
    pm10: Math.round(p10),
    aqi,
    category,
  };
}

/** The current hour in the location's own time zone, as Open-Meteo writes it ("2026-11-19T18:00"). */
function localHourStamp(nowMs: number, utcOffsetSeconds: number | undefined): string {
  const local = new Date(nowMs + (utcOffsetSeconds ?? 0) * 1000);
  return `${local.toISOString().slice(0, 13)}:00`;
}

/** Every usable forecast hour from the current local hour on. */
function parseForecastHours(data: OpenMeteoAirQualityResponse, nowMs: number): HourlyAirQuality[] {
  const times = data.hourly?.time ?? [];
  const pm25Series = data.hourly?.pm2_5 ?? [];
  const pm10Series = data.hourly?.pm10 ?? [];
  const now = localHourStamp(nowMs, data.utc_offset_seconds);
  return times
    .map((time, i) =>
      time >= now ? toHourEntry(time, readingAt(pm25Series, i), readingAt(pm10Series, i)) : null
    )
    .filter((entry): entry is HourlyAirQuality => entry !== null);
}

/** A named place with coordinates. */
export interface Place {
  name: string;
  latitude: number;
  longitude: number;
}

/** Current air quality for a place, read from the first of its hourly entries. */
function summarise(
  place: Place,
  hourly: HourlyAirQuality[],
  dataSource: CurrentAirQuality["dataSource"],
  nowMs: number
): CurrentAirQuality {
  const current = hourly[0];
  const { primaryPollutant } = calculateAQI(current.pm25, current.pm10);
  return {
    city: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    aqi: current.aqi,
    pm25: current.pm25,
    pm10: current.pm10,
    category: current.category,
    primaryPollutant,
    updatedAt: new Date(nowMs).toISOString(),
    dataSource,
    hourly,
  };
}

/**
 * Turn an Open-Meteo response into the next 24 hours of AQI, starting at the
 * current local hour, plus every later forecast hour for the outlook. Times are
 * compared as text in the location's own time zone, so the result does not
 * depend on where the server runs. Returns null when there is not enough usable data.
 */
export function buildAirQuality(
  data: OpenMeteoAirQualityResponse,
  place: Place,
  nowMs: number = Date.now()
): CurrentAirQuality | null {
  const forecastHours = parseForecastHours(data, nowMs);
  const hourly = forecastHours.slice(0, HOURS_TO_KEEP);
  if (hourly.length < MIN_USABLE_HOURS) return null;

  return { ...summarise(place, hourly, "open-meteo", nowMs), forecastHours };
}

/** PM2.5 for one hour of the modelled day. */
function modelledPm25(hour: number): number {
  const period = MODELLED_PM25_PERIODS.find((p) => hour >= p.fromHour && hour <= p.toHour);
  return period?.pm25 ?? MODELLED_BASE_PM25;
}

/**
 * A typical winter-smog day, used only when live data cannot be reached. It
 * peaks around the morning and late evening and dips in the afternoon. The app
 * always labels it as modelled.
 */
export function buildModelledAirQuality(
  cityName: string,
  latitude: number,
  longitude: number,
  nowMs: number = Date.now()
): CurrentAirQuality {
  const offsetMs = MODELLED_UTC_OFFSET_SECONDS * 1000;
  const hourly: HourlyAirQuality[] = Array.from({ length: HOURS_TO_KEEP }, (_, i) => {
    const localTime = new Date(nowMs + offsetMs + i * MS_PER_HOUR);
    const hour = localTime.getUTCHours();
    const pm25 = modelledPm25(hour);
    const pm10 = pm25 * MODELLED_PM10_RATIO;

    const { aqi, category } = calculateAQI(pm25, pm10);
    return {
      time: `${localTime.toISOString().slice(0, 13)}:00`,
      hour,
      pm25,
      pm10: Math.round(pm10),
      aqi,
      category,
    };
  });

  return summarise({ name: cityName, latitude, longitude }, hourly, "modelled", nowMs);
}

/** Current air, a 24-hour forecast and the hours for the outlook, cached for a short time. */
export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  cityName: string
): Promise<CurrentAirQuality> {
  const cacheKey = `aqi:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = aqiCache.get<CurrentAirQuality>(cacheKey);
  if (cached) return { ...cached, city: cityName };

  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=pm10,pm2_5&forecast_days=${FORECAST_DAYS}&timezone=auto`;
    const res = await openMeteoGet(url);
    if (!res.ok) throw new Error(`Open-Meteo returned status ${res.status}`);

    const data: OpenMeteoAirQualityResponse = await res.json();
    const result = buildAirQuality(data, { name: cityName, latitude, longitude });
    if (!result) throw new Error("Open-Meteo returned too little usable data");

    aqiCache.set(cacheKey, result, LIVE_CACHE_MS);
    return result;
  } catch (err) {
    console.warn(
      "Using modelled air quality because live data failed:",
      err instanceof Error ? err.message : "unknown"
    );
    const modelled = buildModelledAirQuality(cityName, latitude, longitude);
    aqiCache.set(cacheKey, modelled, MODELLED_CACHE_MS);
    return modelled;
  }
}
