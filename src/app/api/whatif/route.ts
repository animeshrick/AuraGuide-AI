import { NextRequest } from "next/server";
import { generateWhatIfAnswerWithGemini } from "@/ai/gemini";
import { WhatIfRequestSchema } from "@/ai/schemas";
import { explainWhatIfWithRules, runWhatIf } from "@/domain/whatif";
import { resolveAirQuality } from "@/lib/air-quality-service";
import { apiError, apiJson, enforceRateLimit, readJsonBody } from "@/lib/http";
import { validatePayload } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const validation = validatePayload(WhatIfRequestSchema, body.data);
  if (!validation.success) {
    return apiError("invalid_request", "The what-if request is not valid.", 400, {
      details: validation.errors,
    });
  }
  const { profile, question, memberId, language } = validation.data;

  try {
    const lookup = await resolveAirQuality(profile.city, profile.coordinates);
    if (!lookup.ok) {
      return apiError("city_not_found", "We could not find that city.", 404);
    }
    const { airQuality } = lookup;

    // The engine recalculates first. The model then explains the new numbers.
    const outcome = runWhatIf(profile, airQuality.hourly, question, memberId);
    if (!outcome.matched) {
      return apiJson({ ...outcome, question });
    }

    const aiText = await generateWhatIfAnswerWithGemini({
      question,
      profile,
      outcome,
      aqi: airQuality.aqi,
      category: airQuality.category,
      language,
    });

    return apiJson({
      ...outcome,
      question,
      currentAQI: airQuality.aqi,
      explanation: aiText ?? explainWhatIfWithRules(outcome, airQuality.aqi),
      explanationSource: aiText ? "gemini" : "rules",
    });
  } catch (err) {
    console.error("POST /api/whatif failed:", err instanceof Error ? err.message : "unknown");
    return apiError("internal_error", "Something went wrong while answering that question.", 500);
  }
}
