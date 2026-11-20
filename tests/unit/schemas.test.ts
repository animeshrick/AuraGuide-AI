import {
  AdvisoryRequestSchema,
  GEMINI_PLAN_RESPONSE_SCHEMA,
  GeminiPlanOutputSchema,
  HouseholdProfileSchema,
  WhatIfRequestSchema,
} from "@/ai/schemas";
import { validatePayload } from "@/lib/validation";
import { makeMember, makeProfile } from "./helpers/fixtures";

describe("HouseholdProfileSchema", () => {
  it("accepts a normal household and fills in the default language", () => {
    const withoutLanguage: Partial<ReturnType<typeof makeProfile>> = makeProfile();
    delete withoutLanguage.language;
    const result = HouseholdProfileSchema.safeParse(withoutLanguage);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.language).toBe("en");
  });

  it("rejects a household with no members", () => {
    expect(HouseholdProfileSchema.safeParse(makeProfile({ members: [] })).success).toBe(false);
  });

  it("rejects more than ten members", () => {
    const members = Array.from({ length: 11 }, (_, i) => makeMember({ id: `m${i}` }));
    expect(HouseholdProfileSchema.safeParse(makeProfile({ members })).success).toBe(false);
  });

  it("rejects repeated member ids", () => {
    const members = [makeMember({ id: "same" }), makeMember({ id: "same", name: "Other" })];
    expect(HouseholdProfileSchema.safeParse(makeProfile({ members })).success).toBe(false);
  });

  it.each([
    ["a one-letter city", { city: "A" }],
    ["an unknown cooking fuel", { cookingFuel: "coal" }],
    ["an unknown language", { language: "fr" }],
  ])("rejects %s", (_label, patch) => {
    expect(HouseholdProfileSchema.safeParse({ ...makeProfile(), ...patch }).success).toBe(false);
  });

  it.each([
    ["an impossible age", { age: 121 }],
    ["a negative distance", { commuteDistanceKm: -1 }],
    ["an unknown sensitivity", { sensitivities: ["flu"] }],
    ["an unknown commute mode", { commuteMode: "helicopter" }],
    ["an empty name", { name: "   " }],
    [
      "an activity shorter than five minutes",
      { outdoorActivities: [{ description: "Walk", preferredHour: 7, durationMinutes: 4 }] },
    ],
    [
      "an activity at hour 24",
      { outdoorActivities: [{ description: "Walk", preferredHour: 24, durationMinutes: 30 }] },
    ],
  ])("rejects a member with %s", (_label, patch) => {
    const profile = makeProfile({ members: [{ ...makeMember(), ...patch } as never] });
    expect(HouseholdProfileSchema.safeParse(profile).success).toBe(false);
  });
});

describe("request schemas", () => {
  it("what-if needs a question of reasonable length", () => {
    const profile = makeProfile();
    expect(WhatIfRequestSchema.safeParse({ profile, question: "hi" }).success).toBe(false);
    expect(WhatIfRequestSchema.safeParse({ profile, question: "x".repeat(301) }).success).toBe(
      false
    );
    expect(WhatIfRequestSchema.safeParse({ profile, question: "What if I cycle?" }).success).toBe(
      true
    );
  });

  it("what-if accepts a tapped travel mode, and only a real one", () => {
    const profile = makeProfile();
    const ok = WhatIfRequestSchema.safeParse({ profile, question: "What if?", toMode: "metro" });
    expect(ok.success).toBe(true);
    const bad = WhatIfRequestSchema.safeParse({ profile, question: "What if?", toMode: "jetpack" });
    expect(bad.success).toBe(false);
  });

  it("advisory only accepts known audiences", () => {
    expect(AdvisoryRequestSchema.safeParse({ city: "Delhi", audience: "everyone" }).success).toBe(
      false
    );
    expect(AdvisoryRequestSchema.safeParse({ city: "Delhi", audience: "school" }).success).toBe(
      true
    );
  });
});

describe("Gemini response schema", () => {
  const keysOf = (shape: object) => Object.keys(shape).sort();

  it("lists the same top-level fields as the Zod schema", () => {
    expect(Object.keys(GEMINI_PLAN_RESPONSE_SCHEMA.properties).sort()).toEqual(
      keysOf(GeminiPlanOutputSchema.shape)
    );
    expect([...GEMINI_PLAN_RESPONSE_SCHEMA.required].sort()).toEqual(
      keysOf(GeminiPlanOutputSchema.shape)
    );
  });

  it("lists the same schedule item fields as the Zod schema", () => {
    const zodItem = GeminiPlanOutputSchema.shape.schedule.element.shape;
    const jsonItem = GEMINI_PLAN_RESPONSE_SCHEMA.properties.schedule.items;
    expect(Object.keys(jsonItem.properties).sort()).toEqual(keysOf(zodItem));
    // Every required field in the JSON schema must be required in Zod too.
    for (const key of jsonItem.required) {
      expect(zodItem[key as keyof typeof zodItem].isOptional()).toBe(false);
    }
  });

  it("never asks the model for numbers the engine computes", () => {
    const text = JSON.stringify(GEMINI_PLAN_RESPONSE_SCHEMA);
    for (const field of [
      "normalAQI",
      "optimizedAQI",
      "exposureAvoidedPercentage",
      "savedEmissionsKg",
    ]) {
      expect(text).not.toContain(field);
    }
  });
});

describe("validatePayload", () => {
  it("returns only the field and the rule when input is invalid, never the value", () => {
    const secret = 98765;
    const profile = makeProfile({ members: [makeMember({ age: secret })] });
    const result = validatePayload(HouseholdProfileSchema, profile);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].field).toBe("members.0.age");
    expect(JSON.stringify(result.errors)).not.toContain(String(secret));
  });

  it("returns parsed data with defaults applied", () => {
    const result = validatePayload(AdvisoryRequestSchema, { city: "Delhi", audience: "school" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.language).toBe("en");
  });
});
