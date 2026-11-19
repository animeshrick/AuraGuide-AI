import { calculateEmissionImpact } from "./emissions";
import { calculateHouseholdExposureImpacts } from "./exposure";
import {
  CurrentAirQuality,
  EmissionImpact,
  HouseholdProfile,
  MemberExposureImpact,
  PlanAirQuality,
  SafeWindow,
} from "./types";
import { findSafeWindows } from "./windows";

/** Everything the app computes itself, before any language model is involved. */
export interface EngineFacts {
  safeWindows: SafeWindow[];
  memberImpacts: MemberExposureImpact[];
  emissionImpact: EmissionImpact;
}

export function computeEngineFacts(
  profile: HouseholdProfile,
  airQuality: CurrentAirQuality
): EngineFacts {
  return {
    safeWindows: findSafeWindows(airQuality.hourly),
    memberImpacts: calculateHouseholdExposureImpacts(profile, airQuality.hourly),
    emissionImpact: calculateEmissionImpact(profile),
  };
}

export function toPlanAirQuality(airQuality: CurrentAirQuality): PlanAirQuality {
  return {
    source: airQuality.dataSource,
    updatedAt: airQuality.updatedAt,
    pm25: airQuality.pm25,
    pm10: airQuality.pm10,
    primaryPollutant: airQuality.primaryPollutant,
    hourly: airQuality.hourly,
  };
}
