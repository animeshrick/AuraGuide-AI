import { z } from "zod";
import { LIMITS } from "@/domain/limits";
import { ADVISORY_AUDIENCES } from "@/domain/types";

/** Languages the app writes in. */
const LanguageSchema = z.enum(["en", "hi", "bn"]);

/** Health conditions that tighten a member's safe-air thresholds. */
const HealthSensitivitySchema = z.enum([
  "asthma",
  "pregnant",
  "infant",
  "elderly",
  "outdoor_worker",
  "cardiac",
  "none",
]);

/** How a member spends the working day: a way of travelling, or at home. */
export const CommuteModeSchema = z.enum([
  "walk",
  "bicycle",
  "two_wheeler",
  "auto_rickshaw",
  "bus",
  "metro",
  "car_ice",
  "car_ev",
  "work_from_home",
  "homemaker",
]);

/** The household's main cooking fuel. */
const CookingFuelSchema = z.enum(["lpg", "biomass", "electric"]);

/** A regular outdoor activity: what, when and for how long. */
const OutdoorActivitySchema = z.object({
  description: z.string().trim().min(1).max(LIMITS.activityDescriptionMaxLength),
  preferredHour: z.number().int().min(0).max(23),
  durationMinutes: z.number().int().min(LIMITS.minActivityMinutes).max(LIMITS.maxActivityMinutes),
});

/** One household member as sent by the browser. */
const HouseholdMemberSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(LIMITS.memberNameMaxLength),
  age: z.number().int().min(0).max(LIMITS.maxAge),
  sensitivities: z.array(HealthSensitivitySchema).max(7),
  smokes: z.boolean().optional(),
  commuteMode: CommuteModeSchema,
  commuteDistanceKm: z.number().min(0).max(LIMITS.maxCommuteDistanceKm),
  commuteTimeMinutes: z.number().min(0).max(LIMITS.maxCommuteMinutes),
  outdoorActivities: z.array(OutdoorActivitySchema).max(LIMITS.maxActivitiesPerMember).default([]),
});

export const HouseholdProfileSchema = z
  .object({
    city: z.string().trim().min(LIMITS.cityMinLength).max(LIMITS.cityMaxLength),
    coordinates: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional(),
    members: z.array(HouseholdMemberSchema).min(1).max(LIMITS.maxMembers),
    cookingFuel: CookingFuelSchema,
    usesIncenseOrCoils: z.boolean(),
    hasAirPurifier: z.boolean(),
    language: LanguageSchema.default("en"),
  })
  .refine((p) => new Set(p.members.map((m) => m.id)).size === p.members.length, {
    message: "Household member ids must be unique",
    path: ["members"],
  });

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
const ScheduleActionTypeSchema = z.enum([
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
const IndoorAirAdviceSchema = z.object({
  cookingAdvice: z.string().max(600),
  ventilationWindow: z.string().max(400),
  purifierStrategy: z.string().max(500),
  hazardWarnings: z.array(z.string().max(300)).max(6),
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
});

/**
 * What Gemini is asked to return. It contains words only. Every AQI, exposure
 * and emissions number is filled in by the engine after validation.
 */
export const GeminiPlanOutputSchema = z.object({
  summary: z.string().min(1).max(1500),
  safeWindowTips: z
    .array(
      z.object({
        activity: z.enum(["school_run", "exercise", "ventilation"]),
        recommendation: z.string().min(1).max(300),
      })
    )
    .max(3),
  schedule: z
    .array(
      z.object({
        hour: z.number().int().min(0).max(23),
        timeLabel: z.string().min(1).max(40),
        normalActivity: z.string().min(1).max(250),
        optimizedActivity: z.string().min(1).max(350),
        rationale: z.string().min(1).max(350),
        targetMember: z.string().max(60).optional(),
        actionType: ScheduleActionTypeSchema,
      })
    )
    .min(3)
    .max(14),
  indoorAir: IndoorAirAdviceSchema,
  communityTip: z.string().min(1).max(500),
  memberChanges: z
    .array(
      z.object({
        memberId: z.string().max(64),
        changes: z.array(z.string().min(1).max(250)).min(1).max(6),
      })
    )
    .max(10),
});

export type GeminiPlanOutput = z.infer<typeof GeminiPlanOutputSchema>;

const STRING = { type: "string" } as const;

/**
 * JSON Schema sent to Gemini so the reply is structured. It mirrors
 * GeminiPlanOutputSchema (a unit test keeps the two in step). Zod still
 * validates the reply, because the schema alone is not a guarantee.
 */
export const GEMINI_PLAN_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: STRING,
    safeWindowTips: {
      type: "array",
      items: {
        type: "object",
        properties: {
          activity: { type: "string", enum: ["school_run", "exercise", "ventilation"] },
          recommendation: STRING,
        },
        required: ["activity", "recommendation"],
      },
    },
    schedule: {
      type: "array",
      items: {
        type: "object",
        properties: {
          hour: { type: "integer" },
          timeLabel: STRING,
          normalActivity: STRING,
          optimizedActivity: STRING,
          rationale: STRING,
          targetMember: STRING,
          actionType: { type: "string", enum: ScheduleActionTypeSchema.options },
        },
        required: [
          "hour",
          "timeLabel",
          "normalActivity",
          "optimizedActivity",
          "rationale",
          "actionType",
        ],
      },
    },
    indoorAir: {
      type: "object",
      properties: {
        cookingAdvice: STRING,
        ventilationWindow: STRING,
        purifierStrategy: STRING,
        hazardWarnings: { type: "array", items: STRING },
      },
      required: ["cookingAdvice", "ventilationWindow", "purifierStrategy", "hazardWarnings"],
    },
    communityTip: STRING,
    memberChanges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          memberId: STRING,
          changes: { type: "array", items: STRING },
        },
        required: ["memberId", "changes"],
      },
    },
  },
  required: ["summary", "safeWindowTips", "schedule", "indoorAir", "communityTip", "memberChanges"],
} as const;

/** Body of POST /api/whatif. */
export const WhatIfRequestSchema = z.object({
  profile: HouseholdProfileSchema,
  question: z.string().trim().min(LIMITS.questionMinLength).max(LIMITS.questionMaxLength),
  memberId: z.string().min(1).max(64).optional(),
  /** A travel option the person tapped. When present it is used instead of reading the question. */
  toMode: CommuteModeSchema.optional(),
  language: LanguageSchema.default("en"),
});

/** Body of POST /api/advisory. */
export const AdvisoryRequestSchema = z.object({
  city: z.string().trim().min(LIMITS.cityMinLength).max(LIMITS.cityMaxLength),
  audience: z.enum(ADVISORY_AUDIENCES),
  language: LanguageSchema.default("en"),
});
