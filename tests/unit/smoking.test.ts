import { HouseholdProfileSchema } from "@/ai/schemas";
import { buildPlanPrompt } from "@/ai/prompts";
import { computeEngineFacts } from "@/domain/engine";
import {
  calculateHouseholdExposureImpacts,
  calculateMemberExposure,
  getSensitivityMultiplier,
} from "@/domain/exposure";
import { HEALTH_SENSITIVITY_MULTIPLIERS, SMOKER_MULTIPLIER } from "@/domain/factors";
import { getDictionary } from "@/i18n";
import { makeAirQuality, makeHourly, makeMember, makeProfile } from "./helpers/fixtures";

describe("smoking or vaping is optional", () => {
  it("is not required, and leaving it out changes nothing", () => {
    const member = makeMember({ sensitivities: ["none"] });
    expect("smokes" in member).toBe(false);
    expect(getSensitivityMultiplier(member)).toBe(1);
    expect(getSensitivityMultiplier({ ...member, smokes: false })).toBe(1);
  });

  it("is accepted as true or false, and nothing else", () => {
    const base = makeProfile();
    const withValue = (smokes: unknown) =>
      HouseholdProfileSchema.safeParse({
        ...base,
        members: [{ ...base.members[0], smokes }],
      }).success;
    expect(withValue(true)).toBe(true);
    expect(withValue(false)).toBe(true);
    expect(withValue(undefined)).toBe(true);
    expect(withValue("yes")).toBe(false);
    expect(withValue(1)).toBe(false);
  });
});

describe("smoking in the exposure estimate", () => {
  const hourly = makeHourly(6);
  const profile = makeProfile();

  it("raises the multiplier for someone with no other sensitivity", () => {
    const smoker = makeMember({ sensitivities: ["none"], smokes: true });
    expect(getSensitivityMultiplier(smoker)).toBe(SMOKER_MULTIPLIER);
  });

  it("raises the estimated dose compared with the same person who does not smoke", () => {
    const base = makeMember({ sensitivities: ["none"] });
    const smoker = { ...base, smokes: true };
    expect(calculateMemberExposure(smoker, profile, hourly, "normal")).toBeGreaterThan(
      calculateMemberExposure(base, profile, hourly, "normal")
    );
  });

  it("does not add up with another sensitivity, the higher one counts", () => {
    const smokerWithAsthma = makeMember({ sensitivities: ["asthma"], smokes: true });
    expect(getSensitivityMultiplier(smokerWithAsthma)).toBe(HEALTH_SENSITIVITY_MULTIPLIERS.asthma);
  });

  it("stays below the multiplier for the most sensitive groups", () => {
    expect(SMOKER_MULTIPLIER).toBeGreaterThan(1);
    expect(SMOKER_MULTIPLIER).toBeLessThan(HEALTH_SENSITIVITY_MULTIPLIERS.infant);
  });
});

describe("smoking in the advice", () => {
  const hourly = makeHourly(6);

  it("gives a kind, plain change to a person who smokes, and only to them", () => {
    const family = makeProfile({
      members: [
        makeMember({ id: "a", name: "Ravi", smokes: true }),
        makeMember({ id: "b", name: "Meera" }),
      ],
    });
    const [ravi, meera] = calculateHouseholdExposureImpacts(family, hourly);
    expect(ravi.keyChanges.some((c) => /smoking or vaping indoors/i.test(c))).toBe(true);
    expect(meera.keyChanges.some((c) => /smoking|vaping/i.test(c))).toBe(false);
    const line = ravi.keyChanges.find((c) => /smoking/i.test(c)) ?? "";
    expect(line).not.toMatch(/quit|addict|stop|must|should/i);
  });

  it("tells the model about it only when it is true", () => {
    const airQuality = makeAirQuality();
    const memberLine = (smokes: boolean | undefined) => {
      const profile = makeProfile({ members: [makeMember({ id: "a", smokes })] });
      const prompt = buildPlanPrompt(profile, airQuality, computeEngineFacts(profile, airQuality));
      return prompt.split("\n").find((line) => line.startsWith("- id a: age")) ?? "";
    };
    expect(memberLine(true)).toContain("smokes or vapes");
    expect(memberLine(false)).not.toContain("smokes or vapes");
    expect(memberLine(undefined)).not.toContain("smokes or vapes");
  });

  it("asks the model to stay non-judgemental", () => {
    const airQuality = makeAirQuality();
    const profile = makeProfile({ members: [makeMember({ id: "a", smokes: true })] });
    const prompt = buildPlanPrompt(profile, airQuality, computeEngineFacts(profile, airQuality));
    expect(prompt).toMatch(/kind change without judgement/);
  });
});

describe("smoking in the text people see", () => {
  it("has a label and a hint in every language, and says it is optional", () => {
    for (const language of ["en", "hi", "bn"] as const) {
      const form = getDictionary(language).form;
      expect(form.smokes.trim().length).toBeGreaterThan(0);
      expect(form.smokesHint.trim().length).toBeGreaterThan(0);
    }
    expect(getDictionary("en").form.smokes).toMatch(/optional/i);
  });
});
