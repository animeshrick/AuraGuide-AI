import { HEALTH_SENSITIVITY_MULTIPLIERS } from "@/domain/factors";
import {
  calculateHouseholdExposureImpacts,
  calculateMemberExposure,
  computeIndoorPm25,
  getSensitivityMultiplier,
} from "@/domain/exposure";
import { makeHourly, makeMember, makeProfile } from "./helpers/fixtures";

const hourly = makeHourly(6);

describe("computeIndoorPm25", () => {
  it("is lower with a purifier", () => {
    expect(
      computeIndoorPm25(200, {
        purifierRuns: true,
        cookingFuel: "lpg",
        incenseBurning: false,
        isCookingHour: false,
      })
    ).toBeLessThan(
      computeIndoorPm25(200, {
        purifierRuns: false,
        cookingFuel: "lpg",
        incenseBurning: false,
        isCookingHour: false,
      })
    );
  });

  it("rises with burning biomass while cooking", () => {
    expect(
      computeIndoorPm25(100, {
        purifierRuns: false,
        cookingFuel: "biomass",
        incenseBurning: false,
        isCookingHour: true,
      })
    ).toBeGreaterThan(
      computeIndoorPm25(100, {
        purifierRuns: false,
        cookingFuel: "lpg",
        incenseBurning: false,
        isCookingHour: true,
      })
    );
  });

  it("rises with incense or coils", () => {
    expect(
      computeIndoorPm25(100, {
        purifierRuns: false,
        cookingFuel: "lpg",
        incenseBurning: true,
        isCookingHour: false,
      })
    ).toBeGreaterThan(
      computeIndoorPm25(100, {
        purifierRuns: false,
        cookingFuel: "lpg",
        incenseBurning: false,
        isCookingHour: false,
      })
    );
  });

  it("is zero when there is nothing outdoors and nothing burning", () => {
    expect(
      computeIndoorPm25(0, {
        purifierRuns: false,
        cookingFuel: "lpg",
        incenseBurning: false,
        isCookingHour: false,
      })
    ).toBe(0);
  });
});

describe("getSensitivityMultiplier", () => {
  it("is 1 for a healthy adult", () => {
    expect(getSensitivityMultiplier(makeMember({ sensitivities: ["none"] }))).toBe(1);
  });

  it("takes the highest multiplier, it does not add them up", () => {
    const member = makeMember({ sensitivities: ["elderly", "cardiac"] });
    expect(getSensitivityMultiplier(member)).toBe(
      Math.max(HEALTH_SENSITIVITY_MULTIPLIERS.elderly, HEALTH_SENSITIVITY_MULTIPLIERS.cardiac)
    );
  });
});

describe("calculateMemberExposure", () => {
  const profile = makeProfile();

  it("is higher for a more sensitive person in the same situation", () => {
    const healthy = calculateMemberExposure(makeMember(), profile, hourly);
    const asthmatic = calculateMemberExposure(
      makeMember({ sensitivities: ["asthma"] }),
      profile,
      hourly
    );
    expect(asthmatic).toBeGreaterThan(healthy);
  });

  it("is lower when the air is cleaner", () => {
    const clean = makeHourly(6, 24, () => 20);
    expect(calculateMemberExposure(makeMember(), profile, clean)).toBeLessThan(
      calculateMemberExposure(makeMember(), profile, hourly)
    );
  });

  it("falls when the plan is followed", () => {
    const member = profile.members[1];
    expect(calculateMemberExposure(member, profile, hourly, "optimized")).toBeLessThan(
      calculateMemberExposure(member, profile, hourly, "normal")
    );
  });

  it("is zero with no outdoor data when nothing burns indoors", () => {
    const quiet = makeProfile({ usesIncenseOrCoils: false });
    expect(calculateMemberExposure(makeMember(), quiet, [])).toBe(0);
  });

  it("still counts indoor sources such as incense when there is no outdoor data", () => {
    expect(calculateMemberExposure(makeMember(), profile, [])).toBeGreaterThan(0);
  });
});

describe("calculateHouseholdExposureImpacts", () => {
  const impacts = calculateHouseholdExposureImpacts(makeProfile(), hourly);

  it("returns one result per member, in order", () => {
    expect(impacts.map((i) => i.memberId)).toEqual(["m1", "m2", "m3"]);
  });

  it("keeps avoided exposure between 0 and 100 percent", () => {
    for (const impact of impacts) {
      expect(impact.exposureAvoidedPercentage).toBeGreaterThanOrEqual(0);
      expect(impact.exposureAvoidedPercentage).toBeLessThanOrEqual(100);
      expect(impact.optimizedExposureDose).toBeLessThanOrEqual(impact.baselineExposureDose);
    }
  });

  it("lists the changes for a commuter", () => {
    expect(impacts[0].keyChanges.length).toBeGreaterThan(0);
  });
});
