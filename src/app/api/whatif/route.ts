import { generateWhatIfAnswerWithGemini } from "@/ai/gemini";
import { WhatIfRequestSchema } from "@/ai/schemas";
import { runWhatIf } from "@/domain/whatif";
import { resolveAirQuality } from "@/lib/air-quality-service";
import { cityNotFound, createJsonRoute } from "@/lib/api-route";
import { apiJson } from "@/lib/http";

export const runtime = "nodejs";

/** Recalculate one member's day with a different commute, then explain it with Gemini. */
export const POST = createJsonRoute({
  name: "POST /api/whatif",
  schema: WhatIfRequestSchema,
  invalidMessage: "The what-if request is not valid.",
  failureMessage: "Something went wrong while answering that question.",
  handle: async ({ profile, question, memberId, toMode, language }) => {
    const lookup = await resolveAirQuality(profile.city, profile.coordinates);
    if (!lookup.ok) return cityNotFound();
    const { airQuality } = lookup;

    // The engine recalculates first. The model then explains the new numbers.
    const outcome = runWhatIf(profile, airQuality.hourly, { question, memberId, toMode });
    if (!outcome.matched) {
      return apiJson({ ...outcome, question });
    }

    const explanation = await generateWhatIfAnswerWithGemini({
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
      explanation,
      explanationSource: "gemini",
    });
  },
});
