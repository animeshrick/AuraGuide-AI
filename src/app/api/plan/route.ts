import { NextRequest } from "next/server";
import { GeminiUnavailableError, generateOptimizedPlanWithGemini } from "@/ai/gemini";
import { HouseholdProfileSchema } from "@/ai/schemas";
import { computeEngineFacts } from "@/domain/engine";
import { resolveAirQuality } from "@/lib/air-quality-service";
import { apiError, apiJson, enforceRateLimit, readJsonBody } from "@/lib/http";
import { validatePayload } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const validation = validatePayload(HouseholdProfileSchema, body.data);
  if (!validation.success) {
    return apiError("invalid_request", "The household profile is not valid.", 400, {
      details: validation.errors,
    });
  }
  const profile = validation.data;

  try {
    const lookup = await resolveAirQuality(profile.city, profile.coordinates);
    if (!lookup.ok) {
      return apiError(
        "city_not_found",
        "We could not find that city. Check the spelling or try a nearby larger city.",
        404
      );
    }

    // Numbers come from the engine. The model only writes the words around them.
    const facts = computeEngineFacts(profile, lookup.airQuality);
    const plan = await generateOptimizedPlanWithGemini(profile, lookup.airQuality, facts);
    return apiJson(plan);
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return apiError(
        "ai_unavailable",
        "The AI service did not answer, so nothing was written. The server log shows the reason.",
        503
      );
    }
    console.error("POST /api/plan failed:", err instanceof Error ? err.message : "unknown");
    return apiError("internal_error", "Something went wrong while building the plan.", 500);
  }
}
