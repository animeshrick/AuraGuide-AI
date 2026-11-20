import { MAX_PLANT_SUGGESTIONS, PLANTS, suggestPlants } from "@/domain/plants";
import { getDictionary, SUPPORTED_LANGUAGES } from "@/i18n";
import { makeMember, makeProfile } from "./helpers/fixtures";

const ids = (profile: ReturnType<typeof makeProfile>) =>
  suggestPlants(profile).plants.map((p) => p.id);

describe("suggestPlants", () => {
  it("gives the easiest plants first, five at most, for an ordinary household", () => {
    const profile = makeProfile({ members: [makeMember({ age: 40 })] });
    expect(ids(profile)).toEqual([
      "snake_plant",
      "money_plant",
      "spider_plant",
      "areca_palm",
      "tulsi",
    ]);
    expect(ids(profile).length).toBeLessThanOrEqual(MAX_PLANT_SUGGESTIONS);
    expect(suggestPlants(profile).notes).toEqual([]);
  });

  it("keeps only plants that are safe to chew when a young child lives there", () => {
    const profile = makeProfile({
      members: [makeMember({ age: 40 }), makeMember({ id: "m2", name: "Aarav", age: 4 })],
    });
    const result = suggestPlants(profile);
    expect(result.plants.length).toBeGreaterThan(0);
    expect(result.plants.every((p) => p.childSafe)).toBe(true);
    expect(result.notes).toContain("child_safe");
  });

  it("treats the infant sensitivity as a young child whatever the age says", () => {
    const profile = makeProfile({ members: [makeMember({ age: 30, sensitivities: ["infant"] })] });
    expect(suggestPlants(profile).plants.every((p) => p.childSafe)).toBe(true);
  });

  it("leaves out plants that like damp soil when someone has asthma", () => {
    const profile = makeProfile({
      members: [makeMember({ age: 4 }), makeMember({ id: "m2", sensitivities: ["asthma"] })],
    });
    const result = suggestPlants(profile);
    expect(result.plants.some((p) => p.likesDamp)).toBe(false);
    expect(result.notes).toEqual(["child_safe", "asthma_mould"]);
    // Boston fern is safe for a child but damp, so asthma takes it out.
    expect(ids(profile)).not.toContain("boston_fern");
  });

  it("never claims anything about cleaning the air", () => {
    for (const plant of PLANTS) {
      expect(Object.keys(plant).sort()).toEqual(["childSafe", "id", "light", "likesDamp"]);
    }
  });
});

describe("plant texts", () => {
  it.each(SUPPORTED_LANGUAGES)("has a name and a tip for every plant in %s", (language) => {
    const dict = getDictionary(language);
    expect(Object.keys(dict.plants.plants).sort()).toEqual(PLANTS.map((p) => p.id).sort());
    for (const plant of PLANTS) {
      expect(dict.plants.plants[plant.id].name.length).toBeGreaterThan(0);
      expect(dict.plants.plants[plant.id].tip.length).toBeGreaterThan(0);
    }
  });

  it.each(SUPPORTED_LANGUAGES)("says in %s that plants do not clean smog", (language) => {
    expect(getDictionary(language).plants.honest).toMatch(/PM2\.5/);
  });
});
