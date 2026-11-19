export type AdvisoryAudience = "housing_society" | "school" | "general_public";

const AUDIENCE_LABEL: Record<AdvisoryAudience, string> = {
  housing_society: "Housing society members and RWA",
  school: "School administration, teachers and parents",
  general_public: "Neighbourhood residents",
};

/** A plain advisory used when the AI service is unavailable. */
export function buildFallbackAdvisory(args: {
  city: string;
  aqi: number;
  category: string;
  audience: AdvisoryAudience;
  cleanestWindow?: string;
}): string {
  const { city, aqi, category, audience, cleanestWindow } = args;
  const lines = [
    `AIR QUALITY ADVISORY: ${city.toUpperCase()}`,
    `AQI ${aqi} (${category}). For: ${AUDIENCE_LABEL[audience]}.`,
    "",
    "What we ask everyone to do today:",
    "- Do not burn leaves, wood or waste anywhere on the premises.",
    audience === "school"
      ? "- Hold assembly, sports and physical education indoors."
      : "- Move outdoor sports and children's play indoors.",
    "- Give guards, drivers and cleaning staff N95 masks.",
    "- Share rides or use the metro and bus to cut morning traffic.",
    "",
    "Indoor tips:",
    "- Keep windows and common-area doors closed in the early morning and late evening.",
    cleanestWindow
      ? `- If you need fresh air, open windows briefly around ${cleanestWindow}.`
      : "- If you need fresh air, open windows briefly in the afternoon.",
  ];
  return lines.join("\n");
}
