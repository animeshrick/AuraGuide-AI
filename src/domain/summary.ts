import { DailyPlanResponse, PlanSummary } from "./types";

/** Household-level headline numbers, derived only from the engine's per-member results. */
export function summarizePlan(
  plan: Pick<DailyPlanResponse, "memberImpacts" | "emissionImpact">
): PlanSummary {
  const baselineDoseTotal = plan.memberImpacts.reduce(
    (sum, m) => sum + m.baselineExposureDose,
    0
  );
  const optimizedDoseTotal = plan.memberImpacts.reduce(
    (sum, m) => sum + m.optimizedExposureDose,
    0
  );
  const avoided =
    baselineDoseTotal > 0
      ? Math.round((1 - optimizedDoseTotal / baselineDoseTotal) * 100)
      : 0;

  let highestRiskMember: PlanSummary["highestRiskMember"] = null;
  for (const m of plan.memberImpacts) {
    if (!highestRiskMember || m.baselineExposureDose > highestRiskMember.baselineExposureDose) {
      highestRiskMember = {
        memberId: m.memberId,
        memberName: m.memberName,
        baselineExposureDose: m.baselineExposureDose,
      };
    }
  }

  const { baselineEmissionsKg, savedEmissionsKg } = plan.emissionImpact;
  return {
    householdExposureAvoidedPct: Math.max(0, Math.min(100, avoided)),
    baselineDoseTotal,
    optimizedDoseTotal,
    highestRiskMember,
    emissionsSavedKg: savedEmissionsKg,
    emissionsSavedPct:
      baselineEmissionsKg > 0 ? Math.round((savedEmissionsKg / baselineEmissionsKg) * 100) : 0,
  };
}
