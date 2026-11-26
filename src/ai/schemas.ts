import { z } from "zod";
import { LIMITS } from "@/domain/limits";
import { ADVISORY_AUDIENCES } from "@/domain/types";

/*
 * Request bodies the API accepts, checked on the server before anything else runs.
 * The plan response is in plan-schema.ts and the Gemini reply format in gemini-schema.ts.
 */

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
