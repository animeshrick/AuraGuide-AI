import { z } from "zod";
import { IndoorAirAdviceSchema, ScheduleActionTypeSchema } from "./plan-schema";

/**
 * What Gemini must return for a plan: a Zod schema to check the reply, and the
 * same shape as JSON Schema for the model's structured-output setting.
 */

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
