import { generateOptimizedPlanWithGemini } from "@/ai/gemini";
import { HouseholdProfileSchema } from "@/ai/schemas";
import { computeEngineFacts } from "@/domain/engine";
import { resolveAirQuality } from "@/lib/air-quality-service";
import { cityNotFound, createJsonRoute } from "@/lib/api-route";
import { apiJson } from "@/lib/http";

export const runtime = "nodejs";

/** Build the household's optimised day: engine numbers, Gemini wording. */
export const POST = createJsonRoute({
  name: "POST /api/plan",
  schema: HouseholdProfileSchema,
  invalidMessage: "The household profile is not valid.",
  failureMessage: "Something went wrong while building the plan.",
  handle: async (profile) => {
    const lookup = await resolveAirQuality(profile.city, profile.coordinates);
    if (!lookup.ok) {
      return cityNotFound(
        "We could not find that city. Check the spelling or try a nearby larger city."
      );
    }

    // Numbers come from the engine. The model only writes the words around them.
    const facts = computeEngineFacts(profile, lookup.airQuality);
    const plan = await generateOptimizedPlanWithGemini(profile, lookup.airQuality, facts);
    return apiJson(plan);
  },
});
