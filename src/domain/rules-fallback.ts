import { computeEngineFacts, EngineFacts, toPlanAirQuality } from "./engine";
import { indexByHour } from "./hourly";
import { COMMUTE_MODE_LABELS, formatHour, formatHourRange } from "./labels";
import { effectiveAQI } from "./protection";
import { summarizePlan } from "./summary";
import {
  CurrentAirQuality,
  DailyPlanResponse,
  HourlyAirQuality,
  HouseholdMember,
  HouseholdProfile,
  ScheduleItem,
} from "./types";
import { DAY_MODEL } from "./factors";
import { shiftActivityHour } from "./windows";

const MAX_ACTIVITY_ITEMS = 4;

function shortName(member: HouseholdMember): string {
  return member.name.split(/[\s(]/)[0] || member.name;
}

function timeLabel(startHour: number, durationMinutes: number): string {
  const hours = Math.max(1, Math.ceil(durationMinutes / 60));
  return formatHourRange(startHour, Math.min(24, startHour + hours));
}

/**
 * A personal schedule built only from the household's own routine and the
 * engine's numbers. Every AQI figure comes from the hourly data and the
 * protection factors in `factors.ts`.
 */
export function buildFallbackSchedule(
  profile: HouseholdProfile,
  airQuality: CurrentAirQuality,
  facts: EngineFacts
): ScheduleItem[] {
  const byHour = indexByHour(airQuality.hourly);
  const currentEntry: HourlyAirQuality = airQuality.hourly[0] ?? {
    time: airQuality.updatedAt,
    hour: new Date(airQuality.updatedAt).getUTCHours(),
    pm25: airQuality.pm25,
    pm10: airQuality.pm10,
    aqi: airQuality.aqi,
    category: airQuality.category,
  };
  const entryAt = (hour: number): HourlyAirQuality => byHour.get(hour) ?? currentEntry;
  const hasPurifier = profile.hasAirPurifier;
  const items: ScheduleItem[] = [];

  // 1. Outdoor activities: move to the cleanest hour, or indoors if nothing is cleaner.
  let activityItems = 0;
  for (const member of profile.members) {
    for (const activity of member.outdoorActivities) {
      if (activityItems >= MAX_ACTIVITY_ITEMS) break;
      activityItems += 1;

      const moved = shiftActivityHour(airQuality.hourly, activity.preferredHour);
      const outdoor = entryAt(activity.preferredHour);
      const shifted = moved !== activity.preferredHour;

      items.push({
        hour: activity.preferredHour,
        timeLabel: timeLabel(activity.preferredHour, activity.durationMinutes),
        normalActivity: `${shortName(member)}: ${activity.description}`,
        normalAQI: outdoor.aqi,
        optimizedActivity: shifted
          ? `Move to ${formatHour(moved)}, when the air is cleaner, and keep it light.`
          : "Do this indoors today, or keep it short and slow.",
        optimizedAQI: effectiveAQI(shifted ? "schedule_shift" : "indoor_protection", outdoor, {
          hasPurifier,
          shiftedTo: shifted ? entryAt(moved) : null,
        }),
        rationale: shifted
          ? "Particle levels change through the day. This hour is the cleanest slot for outdoor activity."
          : "No hour today is clearly cleaner. Breathing is deeper during exercise, so indoors is safer.",
        targetMember: member.name,
        actionType: shifted ? "schedule_shift" : "indoor_protection",
      });
    }
  }

  // 2. Commutes: enclosed transport plus a fitted N95.
  const commuters = profile.members.filter((m) => m.commuteMode !== "work_from_home");
  if (commuters.length > 0) {
    const describe = commuters
      .map((m) => `${shortName(m)} by ${COMMUTE_MODE_LABELS[m.commuteMode]}`)
      .join(", ");
    const legs: { hour: number; label: string; rationale: string }[] = [
      {
        hour: DAY_MODEL.morningCommuteHour,
        label: "Morning commute",
        rationale:
          "Open-road travel can expose you to more particles than the air around you. Enclosed transport and a fitted N95 cut what you breathe in.",
      },
      {
        hour: DAY_MODEL.eveningCommuteHour,
        label: "Evening commute",
        rationale:
          "Evening traffic and a falling air layer push particle levels up near the road. Combine errands into one trip.",
      },
    ];
    for (const leg of legs) {
      const outdoor = entryAt(leg.hour);
      items.push({
        hour: leg.hour,
        timeLabel: formatHourRange(leg.hour, leg.hour + 1),
        normalActivity: `${leg.label}: ${describe}`,
        normalAQI: outdoor.aqi,
        optimizedActivity:
          "Use the metro or another enclosed ride where you can, and wear a fitted N95 mask.",
        optimizedAQI: effectiveAQI("mode_swap", outdoor, { hasPurifier }),
        rationale: leg.rationale,
        actionType: "mode_swap",
      });
    }
  }

  // 3. Airing the home at the cleanest slot, only when it beats early-morning airing.
  const ventilation = facts.safeWindows.find((w) => w.activity === "ventilation");
  const morning = entryAt(7);
  if (ventilation && ventilation.averageAQI < morning.aqi) {
    items.push({
      hour: ventilation.startHour,
      timeLabel: formatHourRange(ventilation.startHour, ventilation.endHour),
      normalActivity: "Open the windows first thing in the morning",
      normalAQI: morning.aqi,
      optimizedActivity: `Open windows only around ${formatHourRange(
        ventilation.startHour,
        ventilation.endHour
      )}, then close them.`,
      optimizedAQI: ventilation.averageAQI,
      rationale: "This is the cleanest stretch of the day for letting outside air in.",
      actionType: "indoor_protection",
    });
  }

  // 4. Overnight: sleeping hours are a large share of the day's total exposure.
  const night = entryAt(22);
  items.push({
    hour: 22,
    timeLabel: formatHourRange(22, 24),
    normalActivity: "Sleeping with the room open to outside air (outdoor AQI shown)",
    normalAQI: night.aqi,
    optimizedActivity: hasPurifier
      ? "Close doors and windows and run the purifier in the bedroom overnight."
      : "Close doors and windows, wet-mop the floor, and consider a HEPA purifier for the bedroom.",
    optimizedAQI: effectiveAQI(hasPurifier ? "purifier_timing" : "indoor_protection", night, {
      hasPurifier,
    }),
    rationale:
      "You spend about a third of the day asleep, so cleaner bedroom air lowers the daily total.",
    actionType: hasPurifier ? "purifier_timing" : "indoor_protection",
  });

  return items.sort((a, b) => a.hour - b.hour);
}

export function generateFallbackPlan(
  profile: HouseholdProfile,
  airQuality: CurrentAirQuality,
  facts: EngineFacts = computeEngineFacts(profile, airQuality)
): DailyPlanResponse {
  const city = profile.city || airQuality.city;
  const summary = summarizePlan(facts);
  const ventilation = facts.safeWindows.find((w) => w.activity === "ventilation");

  return {
    isFallback: true,
    city,
    currentAQI: airQuality.aqi,
    currentCategory: airQuality.category,
    summary: `Air quality in ${city} is ${airQuality.category} (AQI ${airQuality.aqi}, mainly ${airQuality.primaryPollutant}). Following this plan lowers the household's estimated exposure by about ${summary.householdExposureAvoidedPct}% and saves ${summary.emissionsSavedKg} kg CO2e of commute emissions today.`,
    airQuality: toPlanAirQuality(airQuality),
    safeWindows: facts.safeWindows,
    memberImpacts: facts.memberImpacts,
    emissionImpact: facts.emissionImpact,
    schedule: buildFallbackSchedule(profile, airQuality, facts),
    indoorAir: {
      cookingAdvice:
        profile.cookingFuel === "biomass"
          ? "Biomass cooking can push indoor PM2.5 far above outdoor levels. Cook with the kitchen door and a window open, keep children away from the stove, and move to LPG or induction when you can."
          : "Keep the kitchen exhaust fan on while cooking and close the kitchen door so oil mist and combustion particles do not spread through the house.",
      ventilationWindow: ventilation
        ? `Open windows only around ${formatHourRange(ventilation.startHour, ventilation.endHour)}. ${ventilation.recommendation}`
        : "Keep windows closed during early morning and late evening, when outdoor air is usually at its worst.",
      purifierStrategy: profile.hasAirPurifier
        ? "Run the purifier in the room where people spend the most time. At night, run it in the bedroom with doors and windows closed."
        : "You have no purifier. Keep one room as a clean room: seal gaps, wet-mop instead of sweeping, and consider a HEPA purifier for the bedroom.",
      hazardWarnings: [
        ...(profile.usesIncenseOrCoils
          ? [
              "Incense and mosquito coils release fine particles and irritant gases indoors. Skip them on smog days, or burn them near an open window.",
            ]
          : []),
        "Avoid hard outdoor exercise in the early morning and evening, when ground-level particle levels are usually highest.",
      ],
    },
    communityTip:
      "Ask your housing society or school to stop open burning of leaves and waste, and to organise carpools for the morning run.",
  };
}
