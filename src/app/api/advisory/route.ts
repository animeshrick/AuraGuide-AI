import { generateCommunityAdvisoryWithGemini } from "@/ai/gemini";
import { AdvisoryRequestSchema } from "@/ai/schemas";
import { formatHourRange } from "@/domain/labels";
import { findSafeWindows } from "@/domain/windows";
import { resolveAirQuality } from "@/lib/air-quality-service";
import { cityNotFound, createJsonRoute } from "@/lib/api-route";
import { apiJson } from "@/lib/http";

export const runtime = "nodejs";

/** Write a short air quality notice for a housing society, school or the public. */
export const POST = createJsonRoute({
  name: "POST /api/advisory",
  schema: AdvisoryRequestSchema,
  invalidMessage: "The advisory request is not valid.",
  failureMessage: "Something went wrong while writing the advisory.",
  handle: async ({ city, audience, language }) => {
    const lookup = await resolveAirQuality(city);
    if (!lookup.ok) return cityNotFound();
    const { airQuality } = lookup;

    const exercise = findSafeWindows(airQuality.hourly).find((w) => w.activity === "exercise");
    const cleanestWindow = exercise
      ? formatHourRange(exercise.startHour, exercise.endHour)
      : undefined;

    const advisoryText = await generateCommunityAdvisoryWithGemini({
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
      advisoryText,
      advisorySource: "gemini",
    });
  },
});
