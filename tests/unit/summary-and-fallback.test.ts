import { DailyPlanResponseSchema } from "@/ai/schemas";
import { buildFallbackAdvisory } from "@/domain/advisory";
import { computeEngineFacts, toPlanAirQuality } from "@/domain/engine";
import { generateFallbackPlan } from "@/domain/rules-fallback";
import { summarizePlan } from "@/domain/summary";
import { makeAirQuality, makeHourly, makeMember, makeProfile } from "./helpers/fixtures";

describe("summarizePlan", () => {
  it("adds the members up and reports the household percentage", () => {
    const summary = summarizePlan({
      memberImpacts: [
        {
          memberId: "a",
          memberName: "A",
          baselineExposureDose: 100,
          optimizedExposureDose: 50,
          exposureAvoidedPercentage: 50,
          keyChanges: [],
        },
        {
          memberId: "b",
          memberName: "B",
          baselineExposureDose: 300,
          optimizedExposureDose: 150,
          exposureAvoidedPercentage: 50,
          keyChanges: [],
        },
      ],
      emissionImpact: {
        baselineEmissionsKg: 10,
        optimizedEmissionsKg: 4,
        savedEmissionsKg: 6,
        modeSwaps: [],
      },
    });

    expect(summary.householdExposureAvoidedPct).toBe(50);
    expect(summary.highestRiskMember?.memberName).toBe("B");
    expect(summary.emissionsSavedKg).toBe(6);
    expect(summary.emissionsSavedPct).toBe(60);
  });

  it("handles an empty household and zero emissions without dividing by zero", () => {
    const summary = summarizePlan({
      memberImpacts: [],
      emissionImpact: {
        baselineEmissionsKg: 0,
        optimizedEmissionsKg: 0,
        savedEmissionsKg: 0,
        modeSwaps: [],
      },
    });
    expect(summary.householdExposureAvoidedPct).toBe(0);
    expect(summary.emissionsSavedPct).toBe(0);
    expect(summary.highestRiskMember).toBeNull();
  });
});

describe("generateFallbackPlan", () => {
  const profile = makeProfile();
  const airQuality = makeAirQuality();
  const plan = generateFallbackPlan(profile, airQuality);

  it("has exactly the shape the browser expects", () => {
    expect(DailyPlanResponseSchema.safeParse(plan).success).toBe(true);
    expect(plan.isFallback).toBe(true);
  });

  it("uses the engine's numbers", () => {
    const facts = computeEngineFacts(profile, airQuality);
    expect(plan.memberImpacts).toEqual(facts.memberImpacts);
    expect(plan.emissionImpact).toEqual(facts.emissionImpact);
    expect(plan.safeWindows).toEqual(facts.safeWindows);
    expect(plan.airQuality).toEqual(toPlanAirQuality(airQuality));
  });

  it("states the computed percentage in the summary", () => {
    const pct = summarizePlan(plan).householdExposureAvoidedPct;
    expect(plan.summary).toContain(`${pct}%`);
    expect(plan.summary).toContain(String(plan.currentAQI));
  });

  it("is in time order and never shows worse air after a change", () => {
    const hours = plan.schedule.map((s) => s.hour);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
    for (const item of plan.schedule) {
      expect(item.optimizedAQI).toBeLessThanOrEqual(item.normalAQI);
    }
  });

  it("builds the schedule from this household's own routine", () => {
    const text = plan.schedule.map((s) => `${s.normalActivity} ${s.optimizedActivity}`).join(" ");
    expect(text).toMatch(/yoga/i);
  });

  it("warns about incense only when the household uses it", () => {
    const withIncense = generateFallbackPlan(makeProfile({ usesIncenseOrCoils: true }), airQuality);
    const without = generateFallbackPlan(makeProfile({ usesIncenseOrCoils: false }), airQuality);
    expect(withIncense.indoorAir.hazardWarnings.join(" ")).toMatch(/incense/i);
    expect(without.indoorAir.hazardWarnings.join(" ")).not.toMatch(/incense/i);
  });

  it("gives biomass-specific cooking advice", () => {
    const biomass = generateFallbackPlan(makeProfile({ cookingFuel: "biomass" }), airQuality);
    expect(biomass.indoorAir.cookingAdvice).toMatch(/biomass/i);
  });

  it("still works with no hourly data", () => {
    const empty = makeAirQuality({ hourly: makeHourly(6, 1) });
    const result = generateFallbackPlan(makeProfile({ members: [makeMember()] }), empty);
    expect(DailyPlanResponseSchema.safeParse(result).success).toBe(true);
  });
});

describe("buildFallbackAdvisory", () => {
  it("names the city, the AQI and the cleanest window", () => {
    const text = buildFallbackAdvisory({
      city: "Patna",
      aqi: 310,
      category: "Very Poor",
      audience: "school",
      cleanestWindow: "13:00 - 14:00",
    });
    expect(text).toContain("PATNA");
    expect(text).toContain("310");
    expect(text).toContain("13:00 - 14:00");
  });

  it("contains no emoji", () => {
    const text = buildFallbackAdvisory({
      city: "Kolkata",
      aqi: 150,
      category: "Moderate",
      audience: "housing_society",
    });
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
