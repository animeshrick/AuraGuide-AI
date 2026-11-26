import { z } from "zod";
import { CommuteModeSchema } from "./schemas";

/**
 * The finished plan the server returns to the browser. Every number in it
 * comes from the engine; the model only supplies the wording.
 */

/** The six Indian National AQI categories. */
const AQICategorySchema = z.enum([
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
]);

/** The kinds of change a plan can suggest. */
export const ScheduleActionTypeSchema = z.enum([
  "schedule_shift",
  "mode_swap",
  "indoor_protection",
  "purifier_timing",
]);

const HourlyAirQualitySchema = z.object({
  time: z.string(),
  hour: z.number().int().min(0).max(23),
  pm25: z.number(),
  pm10: z.number(),
  aqi: z.number(),
  category: AQICategorySchema,
});

/** A clean time window for one kind of activity. */
const SafeWindowSchema = z.object({
  activity: z.enum(["school_run", "exercise", "ventilation", "general_outdoor"]),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  averageAQI: z.number(),
  category: AQICategorySchema,
  recommendation: z.string(),
});

/** One row of the before-and-after day. */
const ScheduleItemSchema = z.object({
  hour: z.number().int().min(0).max(23),
  timeLabel: z.string(),
  normalActivity: z.string(),
  normalAQI: z.number(),
  optimizedActivity: z.string(),
  optimizedAQI: z.number(),
  rationale: z.string(),
  targetMember: z.string().optional(),
  actionType: ScheduleActionTypeSchema,
});

/** One member's exposure on a normal and an optimised day. */
const MemberExposureImpactSchema = z.object({
  memberId: z.string(),
  memberName: z.string(),
  baselineExposureDose: z.number(),
  optimizedExposureDose: z.number(),
  exposureAvoidedPercentage: z.number().min(0).max(100),
  keyChanges: z.array(z.string()),
});

/** Commute emissions before and after the suggested swaps. */
const EmissionImpactSchema = z.object({
  baselineEmissionsKg: z.number(),
  optimizedEmissionsKg: z.number(),
  savedEmissionsKg: z.number(),
  modeSwaps: z.array(
    z.object({
      from: CommuteModeSchema,
      to: CommuteModeSchema,
      savedKg: z.number(),
    })
  ),
});

/** Indoor air advice in the finished plan. */
export const IndoorAirAdviceSchema = z.object({
  cookingAdvice: z.string().max(600),
  ventilationWindow: z.string().max(400),
  purifierStrategy: z.string().max(500),
  hazardWarnings: z.array(z.string().max(300)).max(6),
});

/** One day of the outlook, calculated by the engine. */
const DayOutlookSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  averageAQI: z.number(),
  category: AQICategorySchema,
  peakAQI: z.number(),
  level: z.enum(["good", "careful", "avoid"]),
  bestWindow: z.object({ startHour: z.number(), endHour: z.number(), averageAQI: z.number() }),
  isBestDay: z.boolean(),
});

/** The plan returned to the browser. Tests use it to check the response shape. */
export const DailyPlanResponseSchema = z.object({
  city: z.string(),
  currentAQI: z.number(),
  currentCategory: AQICategorySchema,
  summary: z.string(),
  airQuality: z.object({
    source: z.enum(["open-meteo", "modelled"]),
    updatedAt: z.string(),
    pm25: z.number(),
    pm10: z.number(),
    primaryPollutant: z.enum(["PM2.5", "PM10"]),
    hourly: z.array(HourlyAirQualitySchema),
  }),
  safeWindows: z.array(SafeWindowSchema),
  memberImpacts: z.array(MemberExposureImpactSchema),
  emissionImpact: EmissionImpactSchema,
  schedule: z.array(ScheduleItemSchema),
  indoorAir: IndoorAirAdviceSchema,
  communityTip: z.string(),
  outlook: z.array(DayOutlookSchema),
});
