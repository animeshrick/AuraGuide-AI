import { detectModeFromQuestion, pickMember, runWhatIf } from "@/domain/whatif";
import { makeHourly, makeMember, makeProfile } from "./helpers/fixtures";

describe("detectModeFromQuestion", () => {
  it.each([
    ["What if I cycle to work instead?", "metro", "bicycle"],
    ["What if I take the metro instead of the auto?", "auto_rickshaw", "metro"],
    ["How about cycling instead of taking an auto", "auto_rickshaw", "bicycle"],
    ["What if I work from home?", "car_ice", "work_from_home"],
    ["What if I took the bus?", "car_ice", "bus"],
    ["What if I walk?", "car_ice", "walk"],
    ["What if I buy an electric car?", "car_ice", "car_ev"],
    ["What if I drive instead of the metro?", "metro", "car_ice"],
  ] as const)("%s", (question, current, expected) => {
    expect(detectModeFromQuestion(question, current)).toBe(expected);
  });

  it("matches whole words only", () => {
    expect(detectModeFromQuestion("I bought a scarf", "metro")).toBeNull();
    expect(detectModeFromQuestion("What about the busy road?", "metro")).toBeNull();
  });

  it("returns null when no way of travelling is named", () => {
    expect(detectModeFromQuestion("Is it safe outside?", "metro")).toBeNull();
  });

  it("understands Hindi", () => {
    expect(detectModeFromQuestion("अगर मैं मेट्रो से जाऊँ तो?", "car_ice")).toBe("metro");
    expect(detectModeFromQuestion("ऑटो की जगह साइकिल से जाऊँ तो?", "auto_rickshaw")).toBe("bicycle");
    expect(detectModeFromQuestion("अगर मैं घर से काम करूँ तो?", "bus")).toBe("work_from_home");
  });

  it("understands Bengali, including endings attached to the noun", () => {
    expect(detectModeFromQuestion("আমি মেট্রোতে গেলে কী হবে?", "car_ice")).toBe("metro");
    expect(detectModeFromQuestion("আমি সাইকেলে গেলে কী হবে?", "bus")).toBe("bicycle");
    expect(detectModeFromQuestion("আমি বাড়ি থেকে কাজ করলে কী হবে?", "bus")).toBe("work_from_home");
  });

  it("falls back to the current mode when it is the only one named", () => {
    expect(detectModeFromQuestion("What if I walk?", "walk")).toBe("walk");
  });
});

describe("pickMember", () => {
  const profile = makeProfile();

  it("uses the chosen member first", () => {
    expect(pickMember(profile, "What if Rajesh cycles?", "m2").id).toBe("m2");
  });

  it("finds a member named in the question", () => {
    expect(pickMember(profile, "What if sunita took the metro?").id).toBe("m2");
  });

  it("does not match a name inside another word", () => {
    const tricky = makeProfile({
      members: [
        makeMember({ id: "a", name: "Al", commuteMode: "bus" }),
        makeMember({ id: "b", name: "Bo" }),
      ],
    });
    expect(pickMember(tricky, "what about the metro, all of us?").id).toBe("a");
  });

  it("otherwise picks the first person who commutes", () => {
    const family = makeProfile({
      members: [
        makeMember({ id: "x", name: "Home", commuteMode: "work_from_home", commuteDistanceKm: 0 }),
        makeMember({ id: "y", name: "Out", commuteMode: "bus" }),
      ],
    });
    expect(pickMember(family, "what if we cycle").id).toBe("y");
  });

  it("ignores an unknown member id", () => {
    expect(pickMember(profile, "x", "nobody").id).toBe("m1");
  });
});

describe("runWhatIf", () => {
  const hourly = makeHourly(6);
  const profile = makeProfile();

  it("recalculates household emissions when a car commute becomes the metro", () => {
    const outcome = runWhatIf(profile, hourly, "What if I take the metro instead?", "m1");
    expect(outcome.matched).toBe(true);
    if (!outcome.matched) return;

    expect(outcome.fromMode).toBe("car_ice");
    expect(outcome.toMode).toBe("metro");
    expect(outcome.householdRecalculatedEmissionsKg).toBeLessThan(
      outcome.householdBaselineEmissionsKg
    );
    // Each figure is rounded to two decimals on its own, so allow a hundredth of difference.
    expect(
      Math.abs(
        outcome.savedEmissionsKg -
          (outcome.householdBaselineEmissionsKg - outcome.householdRecalculatedEmissionsKg)
      )
    ).toBeLessThanOrEqual(0.011);
  });

  it("recalculates exposure from the same engine", () => {
    const outcome = runWhatIf(profile, hourly, "What if I cycle instead?", "m1");
    expect(outcome.matched).toBe(true);
    if (!outcome.matched) return;
    expect(outcome.baselineExposureDose).toBeGreaterThan(0);
    expect(outcome.recalculatedExposureDose).toBeGreaterThan(0);
  });

  it("explains why a question could not be answered", () => {
    expect(runWhatIf(profile, hourly, "Is it safe outside?", "m1")).toMatchObject({
      matched: false,
      reason: "no_mode",
    });
    expect(runWhatIf(profile, hourly, "What if I drive?", "m1")).toMatchObject({
      matched: false,
      reason: "same_mode",
    });
    expect(runWhatIf(profile, hourly, "What if I cycle?", "m3")).toMatchObject({
      matched: false,
      reason: "no_commute",
    });
  });
});

describe("runWhatIf with a chosen mode", () => {
  const hourly = makeHourly(6);
  const profile = makeProfile();

  it("uses the chosen mode and ignores what the question says", () => {
    const outcome = runWhatIf(profile, hourly, "What if I cycle?", "m1", "metro");
    expect(outcome).toMatchObject({ matched: true, toMode: "metro" });
  });

  it("works when the question names no mode at all", () => {
    const outcome = runWhatIf(profile, hourly, "What if Rajesh changed to: Bus?", "m1", "bus");
    expect(outcome).toMatchObject({ matched: true, toMode: "bus" });
  });

  it("still says when the chosen mode is the one already used", () => {
    expect(runWhatIf(profile, hourly, "anything", "m1", "car_ice")).toMatchObject({
      matched: false,
      reason: "same_mode",
    });
  });

  it("still says when the person does not travel", () => {
    expect(runWhatIf(profile, hourly, "anything", "m3", "metro")).toMatchObject({
      matched: false,
      reason: "no_commute",
    });
  });
});
