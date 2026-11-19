import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import { EngineFacts, toPlanAirQuality } from "@/domain/engine";
import { indexByHour } from "@/domain/hourly";
import { effectiveAQI } from "@/domain/protection";
import { bestExerciseStartHour } from "@/domain/windows";
import {
  CurrentAirQuality,
  DailyPlanResponse,
  HourlyAirQuality,
  HouseholdProfile,
  SupportedLanguageCode,
  WhatIfOutcome,
} from "@/domain/types";
import { aiPlanCache, aiTextCache } from "@/lib/cache";
import {
  buildAdvisoryPrompt,
  buildPlanPrompt,
  buildWhatIfPrompt,
  SYSTEM_INSTRUCTION,
} from "./prompts";
import {
  GEMINI_PLAN_RESPONSE_SCHEMA,
  GeminiPlanOutput,
  GeminiPlanOutputSchema,
} from "./schemas";

const REQUEST_TIMEOUT_MS = 25_000;
const PLAN_CACHE_TTL_MS = 15 * 60 * 1000;
const TEXT_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_TEXT_LENGTH = 2500;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

/** Never log prompts, keys or the full error object, only a short reason. */
function logFailure(label: string, err: unknown): void {
  const reason = err instanceof Error ? err.message.slice(0, 200) : "unknown error";
  console.error(`${label} failed: ${reason}`);
}

/**
 * A plan is reused only for an identical household, language and hourly air
 * quality, so one family never receives another family's plan.
 */
export function planCacheKey(profile: HouseholdProfile, airQuality: CurrentAirQuality): string {
  return `ai_plan:${hash({
    model: getModelName(),
    profile,
    hourly: airQuality.hourly.map((h) => [h.hour, h.aqi]),
  })}`;
}

/**
 * Combine the model's words with the engine's numbers. Numbers the model might
 * have mentioned are never read. Hours and AQI figures come from the data.
 */
export function finalizeGeminiPlan(
  output: GeminiPlanOutput,
  profile: HouseholdProfile,
  airQuality: CurrentAirQuality,
  facts: EngineFacts
): DailyPlanResponse {
  const byHour = indexByHour(airQuality.hourly);
  const currentEntry: HourlyAirQuality = airQuality.hourly[0] ?? {
    time: airQuality.updatedAt,
    hour: 0,
    pm25: airQuality.pm25,
    pm10: airQuality.pm10,
    aqi: airQuality.aqi,
    category: airQuality.category,
  };
  const shiftHour = bestExerciseStartHour(airQuality.hourly);
  const shiftedTo = shiftHour === null ? null : (byHour.get(shiftHour) ?? null);

  const schedule = [...output.schedule]
    .sort((a, b) => a.hour - b.hour)
    .map((item) => {
      const outdoor = byHour.get(item.hour) ?? currentEntry;
      return {
        ...item,
        normalAQI: outdoor.aqi,
        optimizedAQI: effectiveAQI(item.actionType, outdoor, {
          hasPurifier: profile.hasAirPurifier,
          shiftedTo,
        }),
      };
    });

  return {
    isFallback: false,
    city: profile.city,
    currentAQI: airQuality.aqi,
    currentCategory: airQuality.category,
    summary: output.summary,
    airQuality: toPlanAirQuality(airQuality),
    safeWindows: facts.safeWindows.map((window) => {
      const tip = output.safeWindowTips.find((t) => t.activity === window.activity);
      return tip ? { ...window, recommendation: tip.recommendation } : window;
    }),
    memberImpacts: facts.memberImpacts.map((impact) => {
      const changes = output.memberChanges.find((c) => c.memberId === impact.memberId);
      return changes ? { ...impact, keyChanges: changes.changes } : impact;
    }),
    emissionImpact: facts.emissionImpact,
    schedule,
    indoorAir: output.indoorAir,
    communityTip: output.communityTip,
  };
}

/** One model call per plan. Returns null on any failure so the caller can use the rule-based plan. */
export async function generateOptimizedPlanWithGemini(
  profile: HouseholdProfile,
  airQuality: CurrentAirQuality,
  facts: EngineFacts
): Promise<DailyPlanResponse | null> {
  const client = getClient();
  if (!client) return null;

  const cacheKey = planCacheKey(profile, airQuality);
  const cached = aiPlanCache.get<DailyPlanResponse>(cacheKey);
  if (cached) return cached;

  try {
    const response = await client.models.generateContent({
      model: getModelName(),
      contents: buildPlanPrompt(profile, airQuality, facts),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: GEMINI_PLAN_RESPONSE_SCHEMA,
        temperature: 0.4,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = GeminiPlanOutputSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      console.warn(
        "Gemini plan failed validation:",
        parsed.error.issues.slice(0, 3).map((i) => i.path.join("."))
      );
      return null;
    }

    const plan = finalizeGeminiPlan(parsed.data, profile, airQuality, facts);
    aiPlanCache.set(cacheKey, plan, PLAN_CACHE_TTL_MS);
    return plan;
  } catch (err) {
    logFailure("Gemini plan request", err);
    return null;
  }
}

async function generateText(prompt: string, cacheKeyParts: unknown): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const cacheKey = `ai_text:${hash({ model: getModelName(), cacheKeyParts })}`;
  const cached = aiTextCache.get<string>(cacheKey);
  if (cached) return cached;

  try {
    const response = await client.models.generateContent({
      model: getModelName(),
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.4,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    });
    const text = response.text?.trim();
    if (!text) return null;

    const clipped = text.slice(0, MAX_TEXT_LENGTH);
    aiTextCache.set(cacheKey, clipped, TEXT_CACHE_TTL_MS);
    return clipped;
  } catch (err) {
    logFailure("Gemini text request", err);
    return null;
  }
}

export async function generateWhatIfAnswerWithGemini(args: {
  question: string;
  profile: HouseholdProfile;
  outcome: Extract<WhatIfOutcome, { matched: true }>;
  aqi: number;
  category: string;
  language: SupportedLanguageCode;
}): Promise<string | null> {
  return generateText(buildWhatIfPrompt(args), {
    kind: "whatif",
    question: args.question,
    outcome: args.outcome,
    aqi: args.aqi,
    language: args.language,
  });
}

export async function generateCommunityAdvisoryWithGemini(args: {
  city: string;
  aqi: number;
  category: string;
  audience: "housing_society" | "school" | "general_public";
  language: SupportedLanguageCode;
  cleanestWindow?: string;
}): Promise<string | null> {
  return generateText(buildAdvisoryPrompt(args), { kind: "advisory", ...args });
}
