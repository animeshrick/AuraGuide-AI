import { EMISSION_FACTORS_KG_PER_KM } from "./factors";
import { staysAtHome } from "./modes";
import type { CommuteMode, EmissionImpact, HouseholdProfile } from "./types";

/** Emissions for one person's daily round trip (2 x one-way distance), unrounded. */
export function dailyCommuteEmissionsKg(oneWayDistanceKm: number, mode: CommuteMode): number {
  if (staysAtHome(mode)) return 0;
  const dailyKm = (oneWayDistanceKm || 0) * 2;
  return dailyKm * (EMISSION_FACTORS_KG_PER_KM[mode] || 0);
}

/** Round to two decimal places, the precision shown for kilograms. */
export function roundKg(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The household's commute emissions on a normal day, in kg CO2e. */
export function calculateBaselineEmissions(profile: HouseholdProfile): number {
  let totalKg = 0;
  for (const member of profile.members) {
    totalKg += dailyCommuteEmissionsKg(member.commuteDistanceKm, member.commuteMode);
  }
  return roundKg(totalKg);
}

/** A cleaner way to make the same trip, or the same mode when there is none. */
export function recommendModeSwap(currentMode: CommuteMode): CommuteMode {
  switch (currentMode) {
    case "car_ice":
      return "metro";
    case "auto_rickshaw":
      return "metro";
    case "two_wheeler":
      return "metro";
    case "car_ev":
      return "metro";
    case "bus":
      return "metro";
    default:
      return currentMode;
  }
}

/** Emissions before and after each member makes the recommended swap. */
export function calculateEmissionImpact(profile: HouseholdProfile): EmissionImpact {
  const baselineEmissionsKg = calculateBaselineEmissions(profile);
  let optimizedEmissionsKg = 0;
  const modeSwaps: { from: CommuteMode; to: CommuteMode; savedKg: number }[] = [];

  for (const member of profile.members) {
    if (staysAtHome(member.commuteMode)) continue;

    const dailyKm = (member.commuteDistanceKm || 0) * 2;
    const baselineFactor = EMISSION_FACTORS_KG_PER_KM[member.commuteMode] || 0;
    const targetMode = recommendModeSwap(member.commuteMode);
    const targetFactor = EMISSION_FACTORS_KG_PER_KM[targetMode] || 0;

    const memberBaseline = dailyKm * baselineFactor;
    const memberOptimized = dailyKm * targetFactor;
    optimizedEmissionsKg += memberOptimized;

    if (targetMode !== member.commuteMode) {
      const saved = Math.round((memberBaseline - memberOptimized) * 100) / 100;
      if (saved > 0) {
        modeSwaps.push({
          from: member.commuteMode,
          to: targetMode,
          savedKg: saved,
        });
      }
    }
  }

  optimizedEmissionsKg = Math.round(optimizedEmissionsKg * 100) / 100;
  const savedEmissionsKg = Math.max(
    0,
    Math.round((baselineEmissionsKg - optimizedEmissionsKg) * 100) / 100
  );

  return {
    baselineEmissionsKg,
    optimizedEmissionsKg,
    savedEmissionsKg,
    modeSwaps,
  };
}
