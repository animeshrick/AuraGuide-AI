import { summarizePlan } from "@/domain/summary";

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
