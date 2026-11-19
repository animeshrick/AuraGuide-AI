import {
  calculateBaselineEmissions,
  calculateEmissionImpact,
  dailyCommuteEmissionsKg,
  recommendModeSwap,
  roundKg,
} from "@/domain/emissions";
import { EMISSION_FACTORS_KG_PER_KM } from "@/domain/factors";
import { makeMember, makeProfile } from "./helpers/fixtures";

describe("dailyCommuteEmissionsKg", () => {
  it("counts a round trip", () => {
    expect(dailyCommuteEmissionsKg(10, "car_ice")).toBeCloseTo(
      20 * EMISSION_FACTORS_KG_PER_KM.car_ice,
      6
    );
  });

  it("is zero for people who stay home or have no distance", () => {
    expect(dailyCommuteEmissionsKg(25, "work_from_home")).toBe(0);
    expect(dailyCommuteEmissionsKg(0, "car_ice")).toBe(0);
    expect(dailyCommuteEmissionsKg(Number.NaN, "bus")).toBe(0);
  });

  it("is zero for walking and cycling", () => {
    expect(dailyCommuteEmissionsKg(5, "walk")).toBe(0);
    expect(dailyCommuteEmissionsKg(5, "bicycle")).toBe(0);
  });
});

describe("roundKg", () => {
  it("rounds to two decimals", () => {
    expect(roundKg(1.23456)).toBe(1.23);
    expect(roundKg(2)).toBe(2);
  });
});

describe("recommendModeSwap", () => {
  it("moves motor traffic to the metro", () => {
    for (const mode of ["car_ice", "car_ev", "auto_rickshaw", "two_wheeler", "bus"] as const) {
      expect(recommendModeSwap(mode)).toBe("metro");
    }
  });

  it("leaves low-emission modes alone", () => {
    for (const mode of ["metro", "walk", "bicycle", "work_from_home"] as const) {
      expect(recommendModeSwap(mode)).toBe(mode);
    }
  });
});

describe("calculateEmissionImpact", () => {
  it("adds up the household's commute emissions", () => {
    const profile = makeProfile();
    const expected = roundKg(
      dailyCommuteEmissionsKg(14, "car_ice") + dailyCommuteEmissionsKg(6, "auto_rickshaw")
    );
    expect(calculateBaselineEmissions(profile)).toBe(expected);
  });

  it("shows savings from swapping a car for the metro", () => {
    const profile = makeProfile({ members: [makeMember({ commuteMode: "car_ice" })] });
    const impact = calculateEmissionImpact(profile);

    expect(impact.optimizedEmissionsKg).toBeLessThan(impact.baselineEmissionsKg);
    expect(impact.savedEmissionsKg).toBeCloseTo(
      impact.baselineEmissionsKg - impact.optimizedEmissionsKg,
      2
    );
    expect(impact.modeSwaps).toHaveLength(1);
    expect(impact.modeSwaps[0]).toMatchObject({ from: "car_ice", to: "metro" });
    expect(impact.modeSwaps[0].savedKg).toBeGreaterThan(0);
  });

  it("suggests nothing when everyone already travels cleanly", () => {
    const profile = makeProfile({
      members: [
        makeMember({ commuteMode: "walk" }),
        makeMember({ id: "m2", commuteMode: "work_from_home" }),
      ],
    });
    const impact = calculateEmissionImpact(profile);
    expect(impact.modeSwaps).toEqual([]);
    expect(impact.savedEmissionsKg).toBe(0);
  });

  it("never reports negative savings", () => {
    const impact = calculateEmissionImpact(
      makeProfile({ members: [makeMember({ commuteMode: "car_ev" })] })
    );
    expect(impact.savedEmissionsKg).toBeGreaterThanOrEqual(0);
  });
});
