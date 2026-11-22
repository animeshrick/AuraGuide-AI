import { buildOutlook, outlookLevel } from "@/domain/outlook";
import type { HourlyAirQuality } from "@/domain/types";
import { makeHourly } from "./helpers/fixtures";

/** Four days of hourly data from 19 Nov, with a different pollution level each day. */
function fourDays(pm25ForDay: (day: number, hour: number) => number): HourlyAirQuality[] {
  let i = 0;
  return makeHourly(0, 96, (hour) => pm25ForDay(Math.floor(i++ / 24), hour));
}

const TODAY = "2026-11-19";

describe("outlookLevel", () => {
  it.each([
    [50, "good"],
    [100, "good"],
    [150, "careful"],
    [200, "careful"],
    [201, "avoid"],
  ] as const)("calls AQI %s a %s day", (aqi, level) => {
    expect(outlookLevel(aqi)).toBe(level);
  });
});

describe("buildOutlook", () => {
  it("covers the three days after today, in order", () => {
    const days = buildOutlook(
      fourDays(() => 60),
      TODAY
    );
    expect(days.map((d) => d.date)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
  });

  it("judges each day on its waking hours only", () => {
    // Very dirty at night, clean in the day: the day should still count as good.
    const days = buildOutlook(
      fourDays((_day, hour) => (hour < 7 || hour >= 21 ? 400 : 20)),
      TODAY
    );
    expect(days[0].level).toBe("good");
    expect(days[0].peakAQI).toBeLessThan(100);
  });

  it("marks the cleanest day as the best day", () => {
    const dirtiness = [100, 250, 40, 180];
    const days = buildOutlook(
      fourDays((day) => dirtiness[day]),
      TODAY
    );
    expect(days.filter((d) => d.isBestDay).map((d) => d.date)).toEqual(["2026-11-21"]);
    expect(days.map((d) => d.level)).toEqual(["avoid", "good", "avoid"]);
  });

  it("finds the cleanest two hours in a row, even when one hour alone is cleaner", () => {
    const days = buildOutlook(
      fourDays((_day, hour) => (hour === 9 ? 10 : hour === 15 || hour === 16 ? 40 : 200)),
      TODAY
    );
    expect(days[0].bestWindow).toMatchObject({ startHour: 15, endHour: 17 });
  });

  it("finds the cleanest two-hour window in the day", () => {
    const days = buildOutlook(
      fourDays((_day, hour) => (hour === 14 || hour === 15 ? 30 : 150)),
      TODAY
    );
    expect(days[0].bestWindow).toMatchObject({ startHour: 14, endHour: 16 });
  });

  it("leaves out days with too little data instead of guessing", () => {
    const partial = fourDays(() => 60).filter(
      (h) => !(h.time.startsWith("2026-11-21") && h.hour > 9)
    );
    expect(buildOutlook(partial, TODAY).map((d) => d.date)).toEqual(["2026-11-20", "2026-11-22"]);
  });

  it("has no best day or window when there is nothing to compare", () => {
    const one = fourDays(() => 60).filter((h) => h.time.startsWith("2026-11-20"));
    const [day] = buildOutlook(one, TODAY);
    expect(day.isBestDay).toBe(false);
    expect(buildOutlook(one, undefined)).toEqual([]);
    expect(buildOutlook([], TODAY)).toEqual([]);
  });
});
