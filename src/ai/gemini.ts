import { createHash } from "node:crypto";
import type { EngineFacts } from "@/domain/engine";
import { toPlanAirQuality } from "@/domain/engine";
import { indexByHour } from "@/domain/hourly";
import { effectiveAQI } from "@/domain/protection";
import { bestExerciseStartHour } from "@/domain/windows";
import type {
  CurrentAirQuality,
  DailyPlanResponse,
  HourlyAirQuality,
  HouseholdProfile,
} from "@/domain/types";
import { aiPlanCache, aiTextCache } from "@/lib/cache";
import {
  buildAdvisoryPrompt,
  buildPlanPrompt,
  buildWhatIfPrompt,
  SYSTEM_INSTRUCTION,
} from "./prompts";
import type { AdvisoryPromptInput, WhatIfPromptInput } from "./prompts";
import type { GeminiPlanOutput } from "./gemini-schema";
import { GEMINI_PLAN_RESPONSE_SCHEMA, GeminiPlanOutputSchema } from "./gemini-schema";
import { GeminiUnavailableError } from "./gemini-errors";
import { getClient, getModelName, runWithFallback } from "./model-chain";

/** Longest wait for one model call. */
const REQUEST_TIMEOUT_MS = 45_000;
/** How long a reply is reused for an identical request. */
const REPLY_CACHE_TTL_MS = 15 * 60 * 1000;
/** Longest what-if answer or advisory passed on to the browser, in characters. */
const MAX_TEXT_LENGTH = 2500;
/** Low enough for steady, factual wording; high enough that the text does not read as a template. */
const TEMPERATURE = 0.4;

export { classifyGeminiError, GeminiUnavailableError } from "./gemini-errors";
export type { GeminiFailureReason } from "./gemini-errors";

/** A short, stable fingerprint of a JSON value, used in cache keys. */
function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
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

/** The model's schedule in time order, with the AQI before and after each step taken from the data. */
function buildSchedule(
  items: GeminiPlanOutput["schedule"],
  profile: HouseholdProfile,
  airQuality: CurrentAirQuality
): DailyPlanResponse["schedule"] {
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

  return [...items]
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
  return {
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
    schedule: buildSchedule(output.schedule, profile, airQuality),
    indoorAir: output.indoorAir,
    communityTip: output.communityTip,
    outlook: facts.outlook,
  };
}

/** Read the model's reply as a plan. Throws `bad_output` when it is not JSON or not the expected shape. */
function parsePlanOutput(text: string): GeminiPlanOutput {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GeminiUnavailableError("bad_output", "reply was not JSON");
  }

  const parsed = GeminiPlanOutputSchema.safeParse(json);
  if (!parsed.success) {
    const paths = parsed.error.issues.slice(0, 3).map((i) => i.path.join("."));
    throw new GeminiUnavailableError("bad_output", `fields: ${paths.join(", ")}`);
  }
  return parsed.data;
}

/** One model call per plan. Throws GeminiUnavailableError when the plan cannot be written. */
export async function generateOptimizedPlanWithGemini(
  profile: HouseholdProfile,
  airQuality: CurrentAirQuality,
  facts: EngineFacts
): Promise<DailyPlanResponse> {
  const client = getClient();

  const cacheKey = planCacheKey(profile, airQuality);
  const cached = aiPlanCache.get<DailyPlanResponse>(cacheKey);
  if (cached) return cached;

  const plan = await runWithFallback("plan request", async (model) => {
    const response = await client.models.generateContent({
      model,
      contents: buildPlanPrompt(profile, airQuality, facts),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseJsonSchema: GEMINI_PLAN_RESPONSE_SCHEMA,
        temperature: TEMPERATURE,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    });

    const text = response.text;
    if (!text) {
      const finish = response.candidates?.[0]?.finishReason ?? "unknown";
      throw new GeminiUnavailableError("bad_output", `no text, finish reason ${finish}`);
    }
    return finalizeGeminiPlan(parsePlanOutput(text), profile, airQuality, facts);
  });
  aiPlanCache.set(cacheKey, plan, REPLY_CACHE_TTL_MS);
  return plan;
}

/** One model call for a short piece of plain text, cached by the facts the text depends on. */
async function generateText(prompt: string, cacheKeyParts: unknown): Promise<string> {
  const client = getClient();

  const cacheKey = `ai_text:${hash({ model: getModelName(), cacheKeyParts })}`;
  const cached = aiTextCache.get<string>(cacheKey);
  if (cached) return cached;

  const clipped = await runWithFallback("text request", async (model) => {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: TEMPERATURE,
        abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    });
    const text = response.text?.trim();
    if (!text) throw new GeminiUnavailableError("bad_output", "empty reply");

    return text.slice(0, MAX_TEXT_LENGTH);
  });
  aiTextCache.set(cacheKey, clipped, REPLY_CACHE_TTL_MS);
  return clipped;
}

/** Explain a what-if result in plain words. Throws GeminiUnavailableError when no model answers. */
export async function generateWhatIfAnswerWithGemini(args: WhatIfPromptInput): Promise<string> {
  return generateText(buildWhatIfPrompt(args), {
    kind: "whatif",
    question: args.question,
    outcome: args.outcome,
    aqi: args.aqi,
    language: args.language,
  });
}

/** Write a short, shareable advisory. Throws GeminiUnavailableError when no model answers. */
export async function generateCommunityAdvisoryWithGemini(
  args: AdvisoryPromptInput
): Promise<string> {
  return generateText(buildAdvisoryPrompt(args), { kind: "advisory", ...args });
}
