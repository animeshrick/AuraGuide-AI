import { aqiCache } from "@/lib/cache";
import type { OpenMeteoAirQualityResponse } from "@/lib/open-meteo";
import {
  buildAirQuality,
  buildModelledAirQuality,
  fetchAirQuality,
  geocodeCity,
} from "@/lib/open-meteo";

const HOUR_MS = 3_600_000;

/** Local timestamps such as "2026-11-19T00:00", one per hour, written without any offset. */
function localTimes(count: number, startUtcMs = Date.UTC(2026, 10, 19, 0, 0)): string[] {
  return Array.from({ length: count }, (_, i) =>
    new Date(startUtcMs + i * HOUR_MS).toISOString().slice(0, 16)
  );
}

function makeResponse(
  overrides: Partial<NonNullable<OpenMeteoAirQualityResponse["hourly"]>> = {},
  offsetSeconds = 19_800
): OpenMeteoAirQualityResponse {
  const time = localTimes(48);
  return {
    utc_offset_seconds: offsetSeconds,
    hourly: {
      time,
      pm2_5: time.map(() => 80),
      pm10: time.map(() => 120),
      ...overrides,
    },
  };
}

// 12:50 UTC on 19 Nov 2026 is 18:20 in India (UTC+5:30).
const NOW_UTC = Date.UTC(2026, 10, 19, 12, 50);

describe("buildAirQuality", () => {
  it("keeps every later forecast hour for the outlook", () => {
    const time = localTimes(96);
    const aq = buildAirQuality(
      makeResponse({ time, pm2_5: time.map(() => 80), pm10: time.map(() => 120) }),
      { name: "Delhi", latitude: 0, longitude: 0 },
      NOW_UTC
    );
    expect(aq?.hourly).toHaveLength(24);
    expect(aq?.forecastHours?.length).toBeGreaterThan(70);
    expect(aq?.forecastHours?.[0]).toEqual(aq?.hourly[0]);
  });

  it("starts at the current hour in the city's own time zone", () => {
    const aq = buildAirQuality(
      makeResponse(),
      { name: "Delhi", latitude: 28.6, longitude: 77.2 },
      NOW_UTC
    );
    expect(aq).not.toBeNull();
    expect(aq!.hourly[0].time).toBe("2026-11-19T18:00");
    expect(aq!.hourly[0].hour).toBe(18);
    expect(aq!.hourly).toHaveLength(24);
  });

  it("gives a different start hour for a different offset, whatever the server's time zone", () => {
    // The same instant is 07:50 in New York (UTC-5).
    const aq = buildAirQuality(
      makeResponse({}, -18_000),
      { name: "New York", latitude: 40.7, longitude: -74 },
      NOW_UTC
    );
    expect(aq!.hourly[0].time).toBe("2026-11-19T07:00");
    expect(aq!.hourly[0].hour).toBe(7);
  });

  it("computes the India AQI from PM2.5 and PM10", () => {
    const time = localTimes(48);
    const aq = buildAirQuality(
      makeResponse({ pm2_5: time.map(() => 60), pm10: time.map(() => 0) }),
      { name: "Delhi", latitude: 0, longitude: 0 },
      NOW_UTC
    );
    expect(aq!.aqi).toBe(100);
    expect(aq!.category).toBe("Satisfactory");
    expect(aq!.primaryPollutant).toBe("PM2.5");
    expect(aq!.dataSource).toBe("open-meteo");
  });

  it("skips hours with no reading instead of treating them as clean air", () => {
    const time = localTimes(48);
    const pm25 = time.map((t) => (t >= "2026-11-19T20:00" && t <= "2026-11-19T22:00" ? null : 80));
    const pm10 = time.map((t) => (t >= "2026-11-19T20:00" && t <= "2026-11-19T22:00" ? null : 120));
    const aq = buildAirQuality(
      makeResponse({ pm2_5: pm25, pm10 }),
      { name: "Delhi", latitude: 0, longitude: 0 },
      NOW_UTC
    );

    const times = aq!.hourly.map((h) => h.time);
    expect(times).not.toContain("2026-11-19T20:00");
    expect(times).not.toContain("2026-11-19T22:00");
    expect(times).toContain("2026-11-19T19:00");
    expect(aq!.hourly.every((h) => h.aqi > 0)).toBe(true);
  });

  it("uses a pollutant on its own when the other is missing", () => {
    const time = localTimes(48);
    const aq = buildAirQuality(
      makeResponse({ pm10: time.map(() => null), pm2_5: time.map(() => 100) }),
      { name: "Delhi", latitude: 0, longitude: 0 },
      NOW_UTC
    );
    expect(aq).not.toBeNull();
    expect(aq!.hourly[0].pm25).toBe(100);
  });

  it("returns null when there is too little usable data", () => {
    const time = localTimes(48);
    const allNull = makeResponse({ pm2_5: time.map(() => null), pm10: time.map(() => null) });
    expect(
      buildAirQuality(allNull, { name: "Delhi", latitude: 0, longitude: 0 }, NOW_UTC)
    ).toBeNull();

    // The data ends at 03:00 the next morning, so only 10 hours remain from 18:00.
    const short: OpenMeteoAirQualityResponse = {
      utc_offset_seconds: 19_800,
      hourly: { time: localTimes(28), pm2_5: Array(28).fill(80), pm10: Array(28).fill(80) },
    };
    expect(
      buildAirQuality(short, { name: "Delhi", latitude: 0, longitude: 0 }, NOW_UTC)
    ).toBeNull();
  });

  it("returns null when the forecast is entirely in the past or empty", () => {
    const old = makeResponse();
    expect(
      buildAirQuality(old, { name: "Delhi", latitude: 0, longitude: 0 }, Date.UTC(2026, 11, 30))
    ).toBeNull();
    expect(buildAirQuality({}, { name: "Delhi", latitude: 0, longitude: 0 }, NOW_UTC)).toBeNull();
  });
});

describe("buildModelledAirQuality", () => {
  it("is labelled modelled and covers 24 consecutive hours from the current Indian hour", () => {
    const aq = buildModelledAirQuality("Delhi", 28.6, 77.2, NOW_UTC);
    expect(aq.dataSource).toBe("modelled");
    expect(aq.hourly).toHaveLength(24);
    expect(aq.hourly[0].hour).toBe(18);
    expect(aq.hourly.map((h) => h.hour)).toEqual(
      Array.from({ length: 24 }, (_, i) => (18 + i) % 24)
    );
  });

  it("is worse in the early morning than in the afternoon", () => {
    const aq = buildModelledAirQuality("Delhi", 0, 0, NOW_UTC);
    const at = (hour: number) => aq.hourly.find((h) => h.hour === hour)!.aqi;
    expect(at(7)).toBeGreaterThan(at(14));
  });
});

describe("network functions", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    aqiCache.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW_UTC);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  describe("geocodeCity", () => {
    it("returns the first match", async () => {
      fetchMock.mockResolvedValue(
        json({ results: [{ name: "New Delhi", latitude: 28.6, longitude: 77.2 }] })
      );
      expect(await geocodeCity("Delhi")).toEqual({
        status: "ok",
        name: "New Delhi",
        latitude: 28.6,
        longitude: 77.2,
      });
    });

    it("says not_found for a place that does not exist", async () => {
      fetchMock.mockResolvedValue(json({}));
      expect(await geocodeCity("Nowheresville")).toEqual({ status: "not_found" });
    });

    it("says unavailable, not not_found, when the service fails", async () => {
      fetchMock.mockResolvedValueOnce(json({}, 503));
      expect(await geocodeCity("Delhi")).toEqual({ status: "unavailable" });

      fetchMock.mockRejectedValueOnce(new Error("network down"));
      expect(await geocodeCity("Mumbai")).toEqual({ status: "unavailable" });
    });

    it("remembers a city so it is looked up once", async () => {
      fetchMock.mockResolvedValue(
        json({ results: [{ name: "Patna", latitude: 25.6, longitude: 85.1 }] })
      );
      await geocodeCity("Patna");
      await geocodeCity("  patna ");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("encodes the city in the URL", async () => {
      fetchMock.mockResolvedValue(json({}));
      await geocodeCity("a&b=c d");
      expect(String(fetchMock.mock.calls[0][0])).toContain("name=a%26b%3Dc%20d");
    });
  });

  describe("fetchAirQuality", () => {
    it("returns live data labelled open-meteo", async () => {
      fetchMock.mockResolvedValue(json(makeResponse()));
      const aq = await fetchAirQuality(28.6, 77.2, "Delhi");
      expect(aq.dataSource).toBe("open-meteo");
      expect(aq.hourly[0].hour).toBe(18);
      expect(aq.city).toBe("Delhi");
    });

    it("reuses recent live data", async () => {
      fetchMock.mockResolvedValue(json(makeResponse()));
      await fetchAirQuality(28.6, 77.2, "Delhi");
      const again = await fetchAirQuality(28.6, 77.2, "New Delhi");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(again.city).toBe("New Delhi");
    });

    it.each([
      ["a server error", () => json({}, 500)],
      ["too little data", () => json(makeResponse({ pm2_5: [], pm10: [] }))],
    ])("falls back to the modelled pattern after %s", async (_label, respond) => {
      fetchMock.mockResolvedValue(respond());
      const aq = await fetchAirQuality(10.1, 20.2, "Delhi");
      expect(aq.dataSource).toBe("modelled");
      expect(aq.hourly).toHaveLength(24);
    });

    it("falls back to the modelled pattern when the request fails", async () => {
      fetchMock.mockRejectedValue(new Error("timeout"));
      const aq = await fetchAirQuality(11.1, 21.2, "Delhi");
      expect(aq.dataSource).toBe("modelled");
    });
  });
});
