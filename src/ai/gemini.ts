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
import { GEMINI_PLAN_RESPONSE_SCHEMA, GeminiPlanOutput, GeminiPlanOutputSchema } from "./schemas";

const REQUEST_TIMEOUT_MS = 45_000;
const PLAN_CACHE_TTL_MS = 15 * 60 * 1000;
const TEXT_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_TEXT_LENGTH = 2500;

export type GeminiFailureReason =
  | "missing_key"
  | "invalid_key"
  | "quota"
  | "model_not_found"
  | "timeout"
  | "network"
  | "service_error"
  | "bad_output"
  | "unknown";

/**
 * Thrown whenever Gemini cannot write the text. Nothing falls back to built-in wording: the caller
 * shows the page an "AI unavailable" error, and the server log names the reason.
 */
export class GeminiUnavailableError extends Error {
  constructor(
    public readonly reason: GeminiFailureReason,
    detail = ""
  ) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "GeminiUnavailableError";
  }
}

/** Map an SDK or network error to one short reason. Never returns the message itself. */
export function classifyGeminiError(err: unknown): GeminiFailureReason {
  if (err instanceof GeminiUnavailableError) return err.reason;
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
    return "timeout";
  }
  const status = (err as { status?: unknown })?.status;
  const code = typeof status === "number" ? status : undefined;
  const message = err instanceof Error ? err.message : "";
  if (code === 401 || code === 403 || /API key not valid|API_KEY_INVALID/i.test(message)) {
    return "invalid_key";
  }
  if (code === 429 || /RESOURCE_EXHAUSTED|quota/i.test(message)) return "quota";
  if (code === 404) return "model_not_found";
  if (code !== undefined && code >= 500) return "service_error";
  if (/fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT/i.test(message)) return "network";
  if (err instanceof SyntaxError) return "bad_output";
  return "unknown";
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new GeminiUnavailableError("missing_key", "GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
}

function getModelName(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 32);
}

/** Log the reason and a short message. Never log prompts, keys or household details. */
function logFailure(label: string, err: unknown): GeminiUnavailableError {
  const reason = classifyGeminiError(err);
  const detail = err instanceof Error ? err.message.slice(0, 200) : "";
  console.error(`[gemini] ${label} failed (${reason})${detail ? `: ${detail}` : ""}`);
  return new GeminiUnavailableError(reason, detail);
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
    if (!text) {
      const finish = response.candidates?.[0]?.finishReason ?? "unknown";
      throw new GeminiUnavailableError("bad_output", `no text, finish reason ${finish}`);
    }

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

    const plan = finalizeGeminiPlan(parsed.data, profile, airQuality, facts);
    aiPlanCache.set(cacheKey, plan, PLAN_CACHE_TTL_MS);
    return plan;
  } catch (err) {
    throw logFailure("plan request", err);
  }
}

async function generateText(prompt: string, cacheKeyParts: unknown): Promise<string> {
  const client = getClient();

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
    if (!text) throw new GeminiUnavailableError("bad_output", "empty reply");

    const clipped = text.slice(0, MAX_TEXT_LENGTH);
    aiTextCache.set(cacheKey, clipped, TEXT_CACHE_TTL_MS);
    return clipped;
  } catch (err) {
    throw logFailure("text request", err);
  }
}

export async function generateWhatIfAnswerWithGemini(args: {
  question: string;
  profile: HouseholdProfile;
  outcome: Extract<WhatIfOutcome, { matched: true }>;
  aqi: number;
  category: string;
  language: SupportedLanguageCode;
}): Promise<string> {
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
}): Promise<string> {
  return generateText(buildAdvisoryPrompt(args), { kind: "advisory", ...args });
}
