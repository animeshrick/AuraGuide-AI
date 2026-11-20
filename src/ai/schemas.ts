import { z } from "zod";

export const LanguageSchema = z.enum(["en", "hi", "bn"]);

export const HealthSensitivitySchema = z.enum([
  "asthma",
  "pregnant",
  "infant",
  "elderly",
  "outdoor_worker",
  "cardiac",
  "none",
]);

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

export const CookingFuelSchema = z.enum(["lpg", "biomass", "electric"]);

export const OutdoorActivitySchema = z.object({
  description: z.string().trim().min(1).max(100),
  preferredHour: z.number().int().min(0).max(23),
  durationMinutes: z.number().int().min(5).max(360),
});

export const HouseholdMemberSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(50),
  age: z.number().int().min(0).max(120),
  sensitivities: z.array(HealthSensitivitySchema).max(7),
  smokes: z.boolean().optional(),
  commuteMode: CommuteModeSchema,
  commuteDistanceKm: z.number().min(0).max(200),
  commuteTimeMinutes: z.number().min(0).max(300),
  outdoorActivities: z.array(OutdoorActivitySchema).max(5).default([]),
});

export const HouseholdProfileSchema = z
  .object({
    city: z.string().trim().min(2).max(100),
    coordinates: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .optional(),
    members: z.array(HouseholdMemberSchema).min(1).max(10),
    cookingFuel: CookingFuelSchema,
    usesIncenseOrCoils: z.boolean(),
    hasAirPurifier: z.boolean(),
    language: LanguageSchema.default("en"),
  })
  .refine((p) => new Set(p.members.map((m) => m.id)).size === p.members.length, {
    message: "Household member ids must be unique",
    path: ["members"],
  });

export const AQICategorySchema = z.enum([
  "Good",
  "Satisfactory",
  "Moderate",
  "Poor",
  "Very Poor",
  "Severe",
]);

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

export const SafeWindowSchema = z.object({
  activity: z.enum(["school_run", "exercise", "ventilation", "general_outdoor"]),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
  averageAQI: z.number(),
  category: AQICategorySchema,
  recommendation: z.string(),
});

export const ScheduleItemSchema = z.object({
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

export const MemberExposureImpactSchema = z.object({
  memberId: z.string(),
  memberName: z.string(),
  baselineExposureDose: z.number(),
  optimizedExposureDose: z.number(),
  exposureAvoidedPercentage: z.number().min(0).max(100),
  keyChanges: z.array(z.string()),
});

export const EmissionImpactSchema = z.object({
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

export const IndoorAirAdviceSchema = z.object({
  cookingAdvice: z.string().max(600),
  ventilationWindow: z.string().max(400),
  purifierStrategy: z.string().max(500),
  hazardWarnings: z.array(z.string().max(300)).max(6),
});

/** The plan returned to the browser. Used to check that both plan paths keep the same shape. */
export const DailyPlanResponseSchema = z.object({
  isFallback: z.boolean(),
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

export const WhatIfRequestSchema = z.object({
  profile: HouseholdProfileSchema,
  question: z.string().trim().min(3).max(300),
  memberId: z.string().min(1).max(64).optional(),
  /** A travel option the person tapped. When present it is used instead of reading the question. */
  toMode: CommuteModeSchema.optional(),
  language: LanguageSchema.default("en"),
});

export const AdvisoryRequestSchema = z.object({
  city: z.string().trim().min(2).max(100),
  audience: z.enum(["housing_society", "school", "general_public"]),
  language: LanguageSchema.default("en"),
});
