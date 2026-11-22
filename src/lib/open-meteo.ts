import { calculateAQI } from "@/domain/aqi";
import { CurrentAirQuality, HourlyAirQuality } from "@/domain/types";
import { aqiCache } from "./cache";

const FETCH_TIMEOUT_MS = 8_000;
/** Fewer usable hours than this and the forecast is treated as unavailable. */
const MIN_USABLE_HOURS = 12;
const HOURS_TO_KEEP = 24;
/** The modelled fallback assumes India Standard Time (UTC+5:30). */
const MODELLED_UTC_OFFSET_SECONDS = 19_800;
const MODELLED_CACHE_MS = 60 * 1000;
const LIVE_CACHE_MS = 30 * 60 * 1000;
const GEOCODE_CACHE_MS = 24 * 60 * 60 * 1000;

const HEADERS = { "User-Agent": "AuraGuide-AI/1.0" };

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

/** Look a city up. "not_found" and "unavailable" are kept apart so the app can tell a typo from an outage. */
export async function geocodeCity(city: string): Promise<GeocodeResult> {
  const cacheKey = `geo:${city.toLowerCase().trim()}`;
  const cached = aqiCache.get<Extract<GeocodeResult, { status: "ok" }>>(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      city.trim()
    )}&count=1&language=en&format=json`;
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
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

/**
 * Turn an Open-Meteo response into the next 24 hours of AQI, starting at the
 * current local hour. Times are compared as text in the location's own time
 * zone, so the result does not depend on where the server runs.
 * Returns null when there is not enough usable data.
 */
export function buildAirQuality(
  data: OpenMeteoAirQualityResponse,
  cityName: string,
  latitude: number,
  longitude: number,
  nowMs: number = Date.now()
): CurrentAirQuality | null {
  const times = data.hourly?.time ?? [];
  const pm25Series = data.hourly?.pm2_5 ?? [];
  const pm10Series = data.hourly?.pm10 ?? [];
  const offsetMs = (data.utc_offset_seconds ?? 0) * 1000;

  const localNow = `${new Date(nowMs + offsetMs).toISOString().slice(0, 13)}:00`;
  const start = times.findIndex((t) => t >= localNow);
  if (start < 0) return null;

  const hourly: HourlyAirQuality[] = [];
  for (let i = start; i < times.length && hourly.length < HOURS_TO_KEEP; i++) {
    const pm25 = pm25Series[i];
    const pm10 = pm10Series[i];
    const hasPm25 = typeof pm25 === "number" && Number.isFinite(pm25);
    const hasPm10 = typeof pm10 === "number" && Number.isFinite(pm10);
    if (!hasPm25 && !hasPm10) continue;

    const p25 = hasPm25 ? (pm25 as number) : 0;
    const p10 = hasPm10 ? (pm10 as number) : 0;
    const { aqi, category } = calculateAQI(p25, p10);
    hourly.push({
      time: times[i],
      hour: parseInt(times[i].slice(11, 13), 10),
      pm25: Math.round(p25),
      pm10: Math.round(p10),
      aqi,
      category,
    });
  }

  if (hourly.length < MIN_USABLE_HOURS) return null;

  const current = hourly[0];
  const { primaryPollutant } = calculateAQI(current.pm25, current.pm10);
  return {
    city: cityName,
    latitude,
    longitude,
    aqi: current.aqi,
    pm25: current.pm25,
    pm10: current.pm10,
    category: current.category,
    primaryPollutant,
    updatedAt: new Date(nowMs).toISOString(),
    dataSource: "open-meteo",
    hourly,
  };
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
    const localTime = new Date(nowMs + offsetMs + i * 3_600_000);
    const hour = localTime.getUTCHours();

    let pm25 = 140;
    if (hour >= 6 && hour <= 9) pm25 = 260;
    else if (hour >= 13 && hour <= 16) pm25 = 90;
    else if (hour >= 20 && hour <= 23) pm25 = 220;
    const pm10 = pm25 * 1.6;

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

  const current = hourly[0];
  const { primaryPollutant } = calculateAQI(current.pm25, current.pm10);
  return {
    city: cityName,
    latitude,
    longitude,
    aqi: current.aqi,
    pm25: current.pm25,
    pm10: current.pm10,
    category: current.category,
    primaryPollutant,
    updatedAt: new Date(nowMs).toISOString(),
    dataSource: "modelled",
    hourly,
  };
}

/** Current air and a 24-hour forecast for a location, cached for a short time. */
export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  cityName: string
): Promise<CurrentAirQuality> {
  const cacheKey = `aqi:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = aqiCache.get<CurrentAirQuality>(cacheKey);
  if (cached) return { ...cached, city: cityName };

  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=pm10,pm2_5&forecast_days=2&timezone=auto`;
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Open-Meteo returned status ${res.status}`);

    const data: OpenMeteoAirQualityResponse = await res.json();
    const result = buildAirQuality(data, cityName, latitude, longitude);
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
