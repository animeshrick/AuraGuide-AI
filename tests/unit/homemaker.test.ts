import { CommuteModeSchema, HouseholdProfileSchema } from "@/ai/schemas";
import {
  calculateEmissionImpact,
  dailyCommuteEmissionsKg,
  recommendModeSwap,
} from "@/domain/emissions";
import { calculateMemberExposure } from "@/domain/exposure";
import { COMMUTE_MODE_LABELS } from "@/domain/labels";
import { staysAtHome } from "@/domain/modes";
import { generateFallbackPlan } from "@/domain/rules-fallback";
import { detectModeFromQuestion, pickMember, runWhatIf } from "@/domain/whatif";
import { getDictionary } from "@/i18n";
import { makeAirQuality, makeHourly, makeMember, makeProfile } from "./helpers/fixtures";

describe("staysAtHome", () => {
  it("is true for homemakers and people who work from home only", () => {
    expect(staysAtHome("homemaker")).toBe(true);
    expect(staysAtHome("work_from_home")).toBe(true);
    for (const mode of ["walk", "bicycle", "metro", "bus", "car_ice", "car_ev"] as const) {
      expect(staysAtHome(mode)).toBe(false);
    }
  });
});

describe("homemaker in the engine", () => {
  const hourly = makeHourly(6);

  it("has no commute emissions and nothing to swap", () => {
    expect(dailyCommuteEmissionsKg(25, "homemaker")).toBe(0);
    expect(recommendModeSwap("homemaker")).toBe("homemaker");

    const profile = makeProfile({
      members: [makeMember({ id: "h", name: "Meena", commuteMode: "homemaker" })],
    });
    const impact = calculateEmissionImpact(profile);
    expect(impact.baselineEmissionsKg).toBe(0);
    expect(impact.modeSwaps).toEqual([]);
  });

  it("is exposed like someone working from home, whatever commute numbers are left over", () => {
    const profile = makeProfile();
    const home = makeMember({ commuteMode: "work_from_home", commuteDistanceKm: 0 });
    const homemaker = makeMember({
      commuteMode: "homemaker",
      commuteDistanceKm: 30,
      commuteTimeMinutes: 90,
    });
    expect(calculateMemberExposure(homemaker, profile, hourly, false)).toBe(
      calculateMemberExposure(home, profile, hourly, false)
    );
  });

  it("spends the commuting hours at home, so a homemaker takes in more indoor cooking smoke than a commuter", () => {
    const profile = makeProfile({ cookingFuel: "biomass", hasAirPurifier: false });
    const commuter = makeMember({ commuteMode: "metro", commuteDistanceKm: 10 });
    const homemaker = makeMember({ commuteMode: "homemaker", commuteDistanceKm: 0 });
    const away = calculateMemberExposure(commuter, profile, hourly, false);
    const home = calculateMemberExposure(homemaker, profile, hourly, false);
    expect(home).not.toBe(away);
  });

  it("is left out of the commute advice in the rule-based plan", () => {
    const profile = makeProfile({
      members: [makeMember({ id: "h", name: "Meena", commuteMode: "homemaker" })],
    });
    const plan = generateFallbackPlan(profile, makeAirQuality());
    expect(
      plan.schedule.some((item) => /commute/i.test(item.normalActivity + item.optimizedActivity))
    ).toBe(false);
    expect(JSON.stringify(plan.schedule)).not.toMatch(/running the home/i);
  });

  it("has an English label for engine text", () => {
    expect(COMMUTE_MODE_LABELS.homemaker).toBeTruthy();
  });
});

describe("homemaker in what-if questions", () => {
  it("is never picked as the mode a question is about", () => {
    for (const question of [
      "What if I take the metro?",
      "What if I cycle to work instead?",
      "How would things change if we all took the bus?",
      "What happens if nothing changes?",
    ]) {
      expect(detectModeFromQuestion(question, "car_ice")).not.toBe("homemaker");
    }
    expect(detectModeFromQuestion("What happens if nothing changes?", "car_ice")).toBeNull();
  });

  it("skips homemakers when choosing who the question is about", () => {
    const family = makeProfile({
      members: [
        makeMember({ id: "h", name: "Meena", commuteMode: "homemaker", commuteDistanceKm: 0 }),
        makeMember({ id: "c", name: "Ravi", commuteMode: "bus" }),
      ],
    });
    expect(pickMember(family, "what if we cycle").id).toBe("c");
  });

  it("says a homemaker has no commute to change", () => {
    const family = makeProfile({
      members: [
        makeMember({ id: "h", name: "Meena", commuteMode: "homemaker", commuteDistanceKm: 0 }),
      ],
    });
    const outcome = runWhatIf(family, makeHourly(6), "What if I take the metro?", "h");
    expect(outcome).toMatchObject({ matched: false, reason: "no_commute" });
  });
});

describe("homemaker in requests and text", () => {
  it("is accepted by the request schema", () => {
    expect(CommuteModeSchema.safeParse("homemaker").success).toBe(true);
    const profile = makeProfile({
      members: [makeMember({ id: "h", name: "Meena", commuteMode: "homemaker" })],
    });
    expect(HouseholdProfileSchema.safeParse(profile).success).toBe(true);
  });

  it("is still rejected for a mode that does not exist", () => {
    expect(CommuteModeSchema.safeParse("jetpack").success).toBe(false);
  });

  it("has its own label in every language", () => {
    const labels = (["en", "hi", "bn"] as const).map((lang) => getDictionary(lang).modes);
    for (const modes of labels) {
      expect(modes.homemaker.trim().length).toBeGreaterThan(0);
      expect(modes.homemaker).not.toBe(modes.work_from_home);
    }
    expect(new Set(labels.map((m) => m.homemaker)).size).toBe(3);
  });
});
