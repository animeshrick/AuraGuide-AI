import { indexByHour, averageAQI, meanOf } from "@/domain/hourly";
import { effectiveAQI, protectionFactor } from "@/domain/protection";
import {
  bestExerciseStartHour,
  findBestBlock,
  findSafeWindows,
  shiftActivityHour,
  WINDOW_RULES,
} from "@/domain/windows";
import { makeHourly } from "./helpers/fixtures";

const hourly = makeHourly(6);

describe("hourly helpers", () => {
  it("indexes by local hour and keeps the first entry for a repeated hour", () => {
    const twoDays = makeHourly(0, 30);
    const map = indexByHour(twoDays);
    expect(map.size).toBe(24);
    expect(map.get(3)).toBe(twoDays[3]);
  });

  it("averages", () => {
    expect(meanOf([])).toBe(0);
    expect(meanOf([2, 4])).toBe(3);
    expect(averageAQI([{ aqi: 100 }, { aqi: 201 }])).toBe(151);
  });
});

describe("findBestBlock", () => {
  it("picks the cleanest stretch inside the allowed hours", () => {
    const block = findBestBlock(hourly, 8, 19, 1);
    expect(block).not.toBeNull();
    expect(block!.startHour).toBeGreaterThanOrEqual(12);
    expect(block!.startHour).toBeLessThanOrEqual(16);
    expect(block!.endHour - block!.startHour).toBe(1);
  });

  it("returns null when there is no data", () => {
    expect(findBestBlock([], 8, 19, 1)).toBeNull();
  });
});

describe("findSafeWindows", () => {
  it("returns nothing without data, instead of inventing a window", () => {
    expect(findSafeWindows([])).toEqual([]);
  });

  it("returns a window for each kind of outing, each as long as its rule says", () => {
    const windows = findSafeWindows(hourly);
    expect(windows.map((w) => w.activity).sort()).toEqual([
      "exercise",
      "school_run",
      "ventilation",
    ]);

    for (const w of windows) {
      const rule = WINDOW_RULES[w.activity as keyof typeof WINDOW_RULES];
      expect(w.endHour - w.startHour).toBe(rule.lengthHours);
      expect(w.startHour).toBeGreaterThanOrEqual(rule.fromHour);
      expect(w.recommendation.length).toBeGreaterThan(0);
    }
  });

  it("puts exercise in the cleaner part of the day", () => {
    const exercise = findSafeWindows(hourly).find((w) => w.activity === "exercise")!;
    expect(exercise.startHour).toBeGreaterThanOrEqual(12);
    expect(exercise.startHour).toBeLessThanOrEqual(16);
  });
});

describe("shifting outdoor activities", () => {
  it("moves a dirty-hour activity to a cleaner hour", () => {
    const to = shiftActivityHour(hourly, 7);
    const byHour = indexByHour(hourly);
    expect(byHour.get(to)!.aqi).toBeLessThan(byHour.get(7)!.aqi);
  });

  it("leaves the hour alone when there is no data", () => {
    expect(shiftActivityHour([], 7)).toBe(7);
    expect(bestExerciseStartHour([])).toBeNull();
  });
});

describe("protection", () => {
  const dirty = hourly.find((h) => h.hour === 8)!;
  const clean = hourly.find((h) => h.hour === 14)!;

  it("a fitted N95 on the metro cuts the exposure the most", () => {
    const swap = protectionFactor("mode_swap", false)!;
    expect(swap).toBeLessThan(1);
    expect(swap).toBeLessThan(protectionFactor("indoor_protection", false)!);
  });

  it("a purifier improves indoor protection", () => {
    expect(protectionFactor("indoor_protection", true)!).toBeLessThan(
      protectionFactor("indoor_protection", false)!
    );
  });

  it("never reports a worse AQI than outdoors", () => {
    for (const action of ["mode_swap", "indoor_protection", "purifier_timing"] as const) {
      expect(effectiveAQI(action, dirty, { hasPurifier: false })).toBeLessThanOrEqual(dirty.aqi);
    }
  });

  it("uses the cleaner hour when an activity is shifted there", () => {
    expect(effectiveAQI("schedule_shift", dirty, { hasPurifier: false, shiftedTo: clean })).toBe(
      clean.aqi
    );
  });

  it("does not move an activity into dirtier air", () => {
    expect(
      effectiveAQI("schedule_shift", clean, { hasPurifier: false, shiftedTo: dirty })
    ).toBeLessThanOrEqual(clean.aqi);
  });
});
