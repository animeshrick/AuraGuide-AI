import { CurrentAirQuality } from "@/domain/types";
import { buildModelledAirQuality, fetchAirQuality, geocodeCity } from "./open-meteo";

export type AirQualityLookup =
  | { ok: true; airQuality: CurrentAirQuality }
  | { ok: false; reason: "city_not_found" };

/**
 * One place that turns a city (and optional coordinates) into air quality data,
 * shared by the plan, what-if and advisory routes. Numbers are always fetched
 * on the server, never taken from the browser.
 *
 * A misspelt city is an error the person can fix. If the geocoder or the data
 * source is down, the app falls back to the labelled modelled pattern.
 */
export async function resolveAirQuality(
  city: string,
  coordinates?: { latitude: number; longitude: number }
): Promise<AirQualityLookup> {
  if (coordinates) {
    return {
      ok: true,
      airQuality: await fetchAirQuality(coordinates.latitude, coordinates.longitude, city),
    };
  }

  const geo = await geocodeCity(city);
  if (geo.status === "not_found") return { ok: false, reason: "city_not_found" };
  if (geo.status === "unavailable") {
    return { ok: true, airQuality: buildModelledAirQuality(city, 0, 0) };
  }

  return {
    ok: true,
    airQuality: await fetchAirQuality(geo.latitude, geo.longitude, geo.name),
  };
}
