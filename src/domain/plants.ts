import type { HouseholdProfile } from "./types";

type PlantId =
  | "snake_plant"
  | "money_plant"
  | "spider_plant"
  | "areca_palm"
  | "tulsi"
  | "rubber_plant"
  | "aloe_vera"
  | "peace_lily"
  | "boston_fern";

export type PlantLight = "low" | "bright" | "sun";

interface PlantInfo {
  id: PlantId;
  /** How much light it needs to stay healthy. */
  light: PlantLight;
  /** False when chewing the leaves can make a child or a pet ill. */
  childSafe: boolean;
  /** Wants constantly damp soil or damp air, which can grow mould. */
  likesDamp: boolean;
}

/**
 * Hardy plants that do well in an Indian home, easiest first. The order is the order of
 * suggestion, so a household with few allowed plants still gets the easiest ones.
 */
export const PLANTS: readonly PlantInfo[] = [
  { id: "snake_plant", light: "low", childSafe: false, likesDamp: false },
  { id: "money_plant", light: "low", childSafe: false, likesDamp: false },
  { id: "spider_plant", light: "bright", childSafe: true, likesDamp: false },
  { id: "areca_palm", light: "bright", childSafe: true, likesDamp: false },
  { id: "tulsi", light: "sun", childSafe: true, likesDamp: false },
  { id: "rubber_plant", light: "bright", childSafe: false, likesDamp: false },
  { id: "aloe_vera", light: "sun", childSafe: false, likesDamp: false },
  { id: "peace_lily", light: "low", childSafe: false, likesDamp: true },
  { id: "boston_fern", light: "bright", childSafe: true, likesDamp: true },
];

export const MAX_PLANT_SUGGESTIONS = 5;

/** Age up to which a child is likely to put leaves in the mouth. */
const YOUNG_CHILD_MAX_AGE = 5;

type PlantNote = "child_safe" | "asthma_mould";

interface PlantSuggestions {
  plants: PlantInfo[];
  /** Why the list was narrowed, so the page can say so. */
  notes: PlantNote[];
}

/**
 * Choose plants to suggest for a household.
 *
 * Plants do not clean smog from a room in any measurable way, so this is about picking ones
 * that are safe and easy, not about "air cleaning". It leaves out:
 * - plants that are harmful to chew when a young child lives in the home
 * - plants that like damp soil when someone has asthma, because damp soil can grow mould
 */
export function suggestPlants(profile: HouseholdProfile): PlantSuggestions {
  const hasYoungChild = profile.members.some(
    (m) => m.sensitivities.includes("infant") || m.age <= YOUNG_CHILD_MAX_AGE
  );
  const hasAsthma = profile.members.some((m) => m.sensitivities.includes("asthma"));

  const plants = PLANTS.filter((p) => !(hasYoungChild && !p.childSafe))
    .filter((p) => !(hasAsthma && p.likesDamp))
    .slice(0, MAX_PLANT_SUGGESTIONS);

  const notes: PlantNote[] = [];
  if (hasYoungChild) notes.push("child_safe");
  if (hasAsthma) notes.push("asthma_mould");

  return { plants, notes };
}
