import { NextRequest } from "next/server";
import { GeminiUnavailableError, generateCommunityAdvisoryWithGemini } from "@/ai/gemini";
import { AdvisoryRequestSchema } from "@/ai/schemas";
import { formatHourRange } from "@/domain/labels";
import { findSafeWindows } from "@/domain/windows";
import { resolveAirQuality } from "@/lib/air-quality-service";
import { apiError, apiJson, enforceRateLimit, readJsonBody } from "@/lib/http";
import { validatePayload } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req);
  if (limited) return limited;

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;

  const validation = validatePayload(AdvisoryRequestSchema, body.data);
  if (!validation.success) {
    return apiError("invalid_request", "The advisory request is not valid.", 400, {
      details: validation.errors,
    });
  }
  const { city, audience, language } = validation.data;

  try {
    const lookup = await resolveAirQuality(city);
    if (!lookup.ok) {
      return apiError("city_not_found", "We could not find that city.", 404);
    }
    const { airQuality } = lookup;

    const exercise = findSafeWindows(airQuality.hourly).find((w) => w.activity === "exercise");
    const cleanestWindow = exercise
      ? formatHourRange(exercise.startHour, exercise.endHour)
      : undefined;

    const aiText = await generateCommunityAdvisoryWithGemini({
      city: airQuality.city,
      aqi: airQuality.aqi,
      category: airQuality.category,
      audience,
      language,
      cleanestWindow,
    });

    return apiJson({
      city: airQuality.city,
      currentAQI: airQuality.aqi,
      category: airQuality.category,
      audience,
      dataSource: airQuality.dataSource,
      advisoryText: aiText,
      advisorySource: "gemini",
    });
  } catch (err) {
    if (err instanceof GeminiUnavailableError) {
      return apiError(
        "ai_unavailable",
        "The AI service did not answer, so nothing was written. The server log shows the reason.",
        503
      );
    }
    console.error("POST /api/advisory failed:", err instanceof Error ? err.message : "unknown");
    return apiError("internal_error", "Something went wrong while writing the advisory.", 500);
  }
}
