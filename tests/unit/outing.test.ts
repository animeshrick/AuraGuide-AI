import { OUTING_DURATIONS, OUTING_MODES, outingModeFor, planOuting } from "@/domain/outing";
import type { OutingDuration, OutingMode, PrecautionId } from "@/domain/outing";
import type { HealthSensitivity, HouseholdMember } from "@/domain/types";
import { getDictionary, SUPPORTED_LANGUAGES } from "@/i18n";
import { flatDay, hourlyFrom } from "./helpers/hourly-aqi";
import { makeMember } from "./helpers/fixtures";

function plan(
  aqi: number,
  member: Partial<HouseholdMember> = {},
  options: { hour?: number; duration?: OutingDuration; mode?: OutingMode } = {}
) {
  const advice = planOuting({
    member: makeMember(member),
    hourly: flatDay(aqi),
    hour: options.hour ?? 13,
    duration: options.duration ?? "medium",
    mode: options.mode ?? "on_foot",
  });
  if (!advice) throw new Error("expected advice");
  return advice;
}

const sensitive = (...sensitivities: HealthSensitivity[]) => ({ sensitivities });

describe("the level for a healthy adult", () => {
  it.each([
    [30, "fine"],
    [80, "fine"],
    [150, "fine"],
    [250, "careful"],
    [350, "avoid"],
    [450, "avoid"],
  ])("AQI %i is %s", (aqi, level) => {
    expect(plan(aqi).level).toBe(level);
  });

  it("reports the AQI and category of the chosen hour", () => {
    const advice = planOuting({
      member: makeMember(),
      hourly: hourlyFrom((h) => (h === 9 ? 230 : 60)),
      hour: 9,
      duration: "short",
      mode: "on_foot",
    });
    expect(advice).toMatchObject({ hour: 9, aqi: 230, category: "Poor" });
  });
});

describe("a more sensitive person is held one step stricter", () => {
  it("moves a moderate day from fine to careful for asthma", () => {
    expect(plan(150).level).toBe("fine");
    const advice = plan(150, sensitive("asthma"));
    expect(advice.level).toBe("careful");
    expect(advice.stricter).toBe(true);
  });

  it("does the same for age 60 or more, and for a baby", () => {
    expect(plan(150, { age: 70 }).level).toBe("careful");
    expect(plan(150, { age: 1 }).level).toBe("careful");
  });

  it("does not call a clean day stricter", () => {
    const advice = plan(80, { age: 70 });
    expect(advice.level).toBe("fine");
    expect(advice.stricter).toBe(false);
  });

  it("never goes past the worst level", () => {
    expect(plan(450, sensitive("asthma", "cardiac")).level).toBe("avoid");
  });
});

describe("precautions", () => {
  const steps = (...args: Parameters<typeof plan>) => plan(...args).precautions;

  it("is only the safety step when the air is good", () => {
    expect(steps(40)).toEqual(["symptoms"]);
  });

  it("always ends with the safety step", () => {
    for (const aqi of [40, 150, 250, 350, 450]) {
      const list = steps(aqi, sensitive("asthma"));
      expect(list[list.length - 1]).toBe("symptoms");
    }
  });

  it("makes a mask optional on a moderate day and an N95 from poor air", () => {
    expect(steps(150)).toContain("mask_optional");
    expect(steps(150)).not.toContain("n95");
    expect(steps(250)).toContain("n95");
    expect(steps(250)).not.toContain("mask_optional");
  });

  it("asks to wait only when the level is avoid, and says it first", () => {
    expect(steps(250)).not.toContain("postpone");
    expect(steps(350)[0]).toBe("postpone");
  });

  it("never advises a mask for a baby", () => {
    for (const aqi of [150, 250, 350, 450]) {
      const list = steps(aqi, { age: 1, ...sensitive("infant") });
      expect(list).not.toContain("n95");
      expect(list).not.toContain("mask_optional");
      expect(list).toContain("infant_indoors");
    }
  });

  it("adds a step for each health condition when the air is not good", () => {
    expect(steps(250, sensitive("asthma"))).toContain("inhaler");
    expect(steps(250, sensitive("cardiac"))).toContain("heart_slow");
    expect(steps(250, sensitive("pregnant"))).toContain("pregnant_short");
    expect(steps(250, { age: 65 })).toContain("elderly_company");
    expect(steps(40, sensitive("asthma"))).toEqual(["symptoms"]);
  });

  it("follows how the person travels", () => {
    expect(steps(250, {}, { mode: "on_foot" })).toContain("walk_slow");
    expect(steps(250, {}, { mode: "open_vehicle" })).toContain("helmet_mask");
    expect(steps(250, {}, { mode: "closed_vehicle" })).toContain("recirculate");
    expect(steps(250, {}, { mode: "closed_vehicle" })).not.toContain("walk_slow");
  });

  it("warns about rush hour, except for someone in a closed vehicle", () => {
    expect(steps(250, {}, { hour: 9 })).toContain("quiet_road");
    expect(steps(250, {}, { hour: 18, mode: "open_vehicle" })).toContain("quiet_road");
    expect(steps(250, {}, { hour: 13 })).not.toContain("quiet_road");
    expect(steps(250, {}, { hour: 9, mode: "closed_vehicle" })).not.toContain("quiet_road");
  });

  it("suggests a break indoors only on a long trip", () => {
    expect(steps(250, {}, { duration: "long" })).toContain("break_indoors");
    expect(steps(250, {}, { duration: "medium" })).not.toContain("break_indoors");
    expect(steps(250, {}, { duration: "short" })).not.toContain("break_indoors");
  });

  it("keeps the list short, and keeps the safety step when it is cut", () => {
    const worst = steps(
      450,
      { age: 70, ...sensitive("asthma", "cardiac", "pregnant") },
      { hour: 9, duration: "long" }
    );
    expect(worst).toHaveLength(7);
    expect(worst[0]).toBe("postpone");
    expect(worst[worst.length - 1]).toBe("symptoms");
  });

  it("has a text in every language for every step", () => {
    const all: PrecautionId[] = [];
    for (const aqi of [40, 150, 250, 450]) {
      for (const mode of OUTING_MODES) {
        for (const duration of OUTING_DURATIONS) {
          all.push(
            ...steps(
              aqi,
              { age: 70, ...sensitive("asthma", "cardiac", "pregnant") },
              { mode, duration, hour: 9 }
            ),
            ...steps(aqi, { age: 1, ...sensitive("infant") }, { mode, duration, hour: 9 })
          );
        }
      }
    }
    for (const language of SUPPORTED_LANGUAGES) {
      const texts = getDictionary(language).outing.steps;
      for (const id of new Set(all)) expect(texts[id]?.length).toBeGreaterThan(0);
    }
  });
});

describe("a cleaner time nearby", () => {
  const advice = (aqiAt: (hour: number) => number, hour: number) =>
    planOuting({
      member: makeMember(),
      hourly: hourlyFrom(aqiAt),
      hour,
      duration: "medium",
      mode: "on_foot",
    });

  it("suggests the cleanest hour within three hours", () => {
    const result = advice((h) => (h === 8 ? 300 : h === 10 ? 120 : h === 11 ? 150 : 280), 8);
    expect(result?.cleaner).toMatchObject({ hour: 10, aqi: 120 });
  });

  it("prefers the hour closer to the chosen one when two are equally clean", () => {
    const result = advice((h) => (h === 7 || h === 10 ? 100 : 300), 8);
    expect(result?.cleaner?.hour).toBe(7);
  });

  it("says nothing when the difference would not be felt", () => {
    expect(advice((h) => (h === 9 ? 90 : 100), 8)?.cleaner).toBeNull();
    expect(advice((h) => (h === 9 ? 270 : 300), 8)?.cleaner).toBeNull();
  });

  it("never suggests the middle of the night", () => {
    const result = advice((h) => (h >= 6 && h <= 21 ? 300 : 40), 8);
    expect(result?.cleaner).toBeNull();
    const late = advice((h) => (h >= 6 && h <= 21 ? 300 : 40), 22);
    expect(late?.cleaner).toBeNull();
  });

  it("looks across midnight for a late evening trip", () => {
    const result = advice((h) => (h === 21 ? 120 : 300), 23);
    expect(result?.cleaner).toMatchObject({ hour: 21, aqi: 120 });
  });
});

describe("missing data", () => {
  it("returns nothing when there is no forecast", () => {
    expect(
      planOuting({ member: makeMember(), hourly: [], hour: 8, duration: "short", mode: "on_foot" })
    ).toBeNull();
  });

  it("uses the average when the chosen hour is not in the forecast", () => {
    const partial = hourlyFrom(() => 250).filter((h) => h.hour >= 12);
    const result = planOuting({
      member: makeMember(),
      hourly: partial,
      hour: 8,
      duration: "short",
      mode: "on_foot",
    });
    expect(result).toMatchObject({ aqi: 250, category: "Poor" });
  });
});

describe("outingModeFor", () => {
  it("groups how people usually travel by how much road air they breathe", () => {
    expect(outingModeFor("walk")).toBe("on_foot");
    expect(outingModeFor("bicycle")).toBe("on_foot");
    expect(outingModeFor("homemaker")).toBe("on_foot");
    expect(outingModeFor("two_wheeler")).toBe("open_vehicle");
    expect(outingModeFor("auto_rickshaw")).toBe("open_vehicle");
    expect(outingModeFor("car_ice")).toBe("closed_vehicle");
    expect(outingModeFor("car_ev")).toBe("closed_vehicle");
    expect(outingModeFor("bus")).toBe("closed_vehicle");
    expect(outingModeFor("metro")).toBe("closed_vehicle");
  });
});
