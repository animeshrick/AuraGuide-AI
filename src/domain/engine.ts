import { calculateEmissionImpact } from "./emissions";
import { calculateHouseholdExposureImpacts } from "./exposure";
import { buildOutlook } from "./outlook";
import {
  CurrentAirQuality,
  DayOutlook,
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
  outlook: DayOutlook[];
}

/** Every number in a plan, computed before the model is called. */
export function computeEngineFacts(
  profile: HouseholdProfile,
  airQuality: CurrentAirQuality
): EngineFacts {
  return {
    safeWindows: findSafeWindows(airQuality.hourly),
    memberImpacts: calculateHouseholdExposureImpacts(profile, airQuality.hourly),
    emissionImpact: calculateEmissionImpact(profile),
    outlook: buildOutlook(airQuality.forecastHours ?? [], airQuality.hourly[0]?.time.slice(0, 10)),
  };
}

/** The part of the air quality data the browser shows. */
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
