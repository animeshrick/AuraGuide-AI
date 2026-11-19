import { calculateAQI, getAQIBadgeClass, getAQICategory, getAQIColor } from "@/domain/aqi";

describe("calculateAQI (India National AQI)", () => {
  it("maps PM2.5 band edges to the CPCB index values", () => {
    expect(calculateAQI(0).aqi).toBe(0);
    expect(calculateAQI(30).aqi).toBe(50);
    expect(calculateAQI(60).aqi).toBe(100);
    expect(calculateAQI(90).aqi).toBe(200);
    expect(calculateAQI(120).aqi).toBe(300);
    expect(calculateAQI(250).aqi).toBe(400);
    expect(calculateAQI(500).aqi).toBe(500);
  });

  it("does not drop readings that fall between the published whole-number bands", () => {
    // 60.5 sits between the 31-60 and 61-90 rows. It must not come back as 0.
    expect(calculateAQI(60.5).aqi).toBeGreaterThanOrEqual(100);
    expect(calculateAQI(30.5).aqi).toBeGreaterThanOrEqual(50);
    expect(calculateAQI(120.4).aqi).toBeGreaterThanOrEqual(300);
  });

  it("uses the worse of PM2.5 and PM10 and names it", () => {
    const pm10Heavy = calculateAQI(10, 400);
    expect(pm10Heavy.primaryPollutant).toBe("PM10");
    expect(pm10Heavy.aqi).toBeGreaterThan(300);

    const pm25Heavy = calculateAQI(200, 50);
    expect(pm25Heavy.primaryPollutant).toBe("PM2.5");
  });

  it("keeps rising past the top of the scale, with a ceiling", () => {
    expect(calculateAQI(600).aqi).toBeGreaterThan(500);
    expect(calculateAQI(1_000_000).aqi).toBeLessThanOrEqual(999);
  });

  it("treats missing, negative and non-finite readings as zero", () => {
    expect(calculateAQI(-5).aqi).toBe(0);
    expect(calculateAQI(Number.NaN).aqi).toBe(0);
    expect(calculateAQI(Number.POSITIVE_INFINITY).aqi).toBe(0);
  });

  it("returns the category that goes with the index", () => {
    expect(calculateAQI(200).category).toBe("Very Poor");
  });
});

describe("getAQICategory", () => {
  it.each([
    [0, "Good"],
    [50, "Good"],
    [51, "Satisfactory"],
    [100, "Satisfactory"],
    [101, "Moderate"],
    [200, "Moderate"],
    [201, "Poor"],
    [300, "Poor"],
    [301, "Very Poor"],
    [400, "Very Poor"],
    [401, "Severe"],
    [999, "Severe"],
  ] as const)("AQI %i is %s", (aqi, category) => {
    expect(getAQICategory(aqi)).toBe(category);
  });
});

describe("AQI styling helpers", () => {
  it("gives every category a colour and a badge class", () => {
    for (const category of [
      "Good",
      "Satisfactory",
      "Moderate",
      "Poor",
      "Very Poor",
      "Severe",
    ] as const) {
      expect(getAQIColor(category)).toMatch(/^#[0-9a-f]{6}$/i);
      expect(getAQIBadgeClass(category).length).toBeGreaterThan(0);
    }
  });
});
