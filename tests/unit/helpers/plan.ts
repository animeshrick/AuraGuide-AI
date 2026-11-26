import { finalizeGeminiPlan } from "@/ai/gemini";
import type { GeminiPlanOutput } from "@/ai/gemini-schema";
import { computeEngineFacts } from "@/domain/engine";
import type { CurrentAirQuality, DailyPlanResponse, HouseholdProfile } from "@/domain/types";
import { makeAirQuality, makeProfile } from "./fixtures";

/** A well-formed model reply for the default test household. */
export const SAMPLE_MODEL_OUTPUT: GeminiPlanOutput = {
  summary: "The air is very poor this morning and evening. Move outdoor time to the afternoon.",
  safeWindowTips: [{ activity: "exercise", recommendation: "Walk in the early afternoon." }],
  schedule: [
    {
      hour: 7,
      timeLabel: "07:00 - 08:00",
      normalActivity: "Morning yoga outside",
      optimizedActivity: "Do yoga indoors",
      rationale: "The air is at its worst at this hour.",
      targetMember: "Sunita",
      actionType: "indoor_protection",
    },
    {
      hour: 8,
      timeLabel: "08:00 - 09:00",
      normalActivity: "Commute by car",
      optimizedActivity: "Take the metro with an N95",
      rationale: "The metro keeps you out of the heaviest traffic smoke.",
      targetMember: "Rajesh",
      actionType: "mode_swap",
    },
    {
      hour: 14,
      timeLabel: "14:00 - 15:00",
      normalActivity: "Nothing planned",
      optimizedActivity: "Open the windows",
      rationale: "This is the cleanest part of the day.",
      actionType: "schedule_shift",
    },
  ],
  indoorAir: {
    cookingAdvice: "Use the exhaust fan.",
    ventilationWindow: "Open windows from 14:00 to 16:00.",
    purifierStrategy: "Run it in the bedroom at night.",
    hazardWarnings: ["Skip incense."],
  },
  communityTip: "Ask the society to stop leaf burning.",
  memberChanges: [{ memberId: "m1", changes: ["Wear an N95 on the metro."] }],
};

/**
 * Build a plan the same way the server does: the engine's numbers plus the
 * sample model reply.
 */
export function makePlan(
  profile: HouseholdProfile = makeProfile(),
  airQuality: CurrentAirQuality = makeAirQuality()
): DailyPlanResponse {
  const facts = computeEngineFacts(profile, airQuality);
  return finalizeGeminiPlan(SAMPLE_MODEL_OUTPUT, profile, airQuality, facts);
}
