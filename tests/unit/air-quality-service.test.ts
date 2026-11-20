import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeAirQuality } from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({
  geocodeCity: vi.fn(),
  fetchAirQuality: vi.fn(),
  buildModelledAirQuality: vi.fn(),
}));

vi.mock("@/lib/open-meteo", () => mocks);

import { resolveAirQuality } from "@/lib/air-quality-service";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("resolveAirQuality", () => {
  it("uses the coordinates when they are given and skips the place lookup", async () => {
    const live = makeAirQuality();
    mocks.fetchAirQuality.mockResolvedValue(live);

    const result = await resolveAirQuality("Delhi", { latitude: 28.6, longitude: 77.2 });

    expect(result).toEqual({ ok: true, airQuality: live });
    expect(mocks.geocodeCity).not.toHaveBeenCalled();
    expect(mocks.fetchAirQuality).toHaveBeenCalledWith(28.6, 77.2, "Delhi");
  });

  it("looks the city up and uses the name the geocoder returns", async () => {
    const live = makeAirQuality({ city: "Kolkata" });
    mocks.geocodeCity.mockResolvedValue({
      status: "ok",
      latitude: 22.57,
      longitude: 88.36,
      name: "Kolkata",
    });
    mocks.fetchAirQuality.mockResolvedValue(live);

    const result = await resolveAirQuality("kolkta");

    expect(result).toEqual({ ok: true, airQuality: live });
    expect(mocks.fetchAirQuality).toHaveBeenCalledWith(22.57, 88.36, "Kolkata");
  });

  it("reports a city that does not exist, so the person can fix the spelling", async () => {
    mocks.geocodeCity.mockResolvedValue({ status: "not_found" });

    expect(await resolveAirQuality("Zzzzzz")).toEqual({ ok: false, reason: "city_not_found" });
    expect(mocks.fetchAirQuality).not.toHaveBeenCalled();
  });

  it("uses the labelled modelled pattern when the geocoder is down", async () => {
    const modelled = makeAirQuality({ dataSource: "modelled" });
    mocks.geocodeCity.mockResolvedValue({ status: "unavailable" });
    mocks.buildModelledAirQuality.mockReturnValue(modelled);

    const result = await resolveAirQuality("Delhi");

    expect(result).toEqual({ ok: true, airQuality: modelled });
    expect(mocks.buildModelledAirQuality).toHaveBeenCalledWith("Delhi", 0, 0);
    expect(mocks.fetchAirQuality).not.toHaveBeenCalled();
  });
});
