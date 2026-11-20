import { aiPlanCache, aiTextCache } from "@/lib/cache";
import { computeEngineFacts } from "@/domain/engine";
import { generateFallbackPlan } from "@/domain/rules-fallback";
import { runWhatIf } from "@/domain/whatif";
import { DailyPlanResponseSchema } from "@/ai/schemas";
import {
  classifyGeminiError,
  finalizeGeminiPlan,
  GeminiUnavailableError,
  generateCommunityAdvisoryWithGemini,
  generateOptimizedPlanWithGemini,
  generateWhatIfAnswerWithGemini,
  planCacheKey,
} from "@/ai/gemini";
import { makeAirQuality, makeHourly, makeMember, makeProfile } from "./helpers/fixtures";

const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const validOutput = {
  summary: "The air is very poor this morning and evening. Move outdoor time to the afternoon.",
  safeWindowTips: [{ activity: "exercise", recommendation: "Walk in the early afternoon." }],
  schedule: [
    {
      hour: 7,
      timeLabel: "07:00 - 08:00",
      normalActivity: "Morning yoga outside",
      optimizedActivity: "Do yoga indoors",
      rationale: "The air is at its worst at this hour.",
      targetMember: "Sunita",
      actionType: "indoor_protection",
      // A model that invents numbers must not get them into the plan.
      normalAQI: 1,
      optimizedAQI: 1,
    },
    {
      hour: 8,
      timeLabel: "08:00 - 09:00",
      normalActivity: "Commute by car",
      optimizedActivity: "Take the metro with an N95",
      rationale: "The metro keeps you out of the heaviest traffic smoke.",
      targetMember: "Rajesh",
      actionType: "mode_swap",
    },
    {
      hour: 14,
      timeLabel: "14:00 - 15:00",
      normalActivity: "Nothing planned",
      optimizedActivity: "Open the windows",
      rationale: "This is the cleanest part of the day.",
      actionType: "schedule_shift",
    },
  ],
  indoorAir: {
    cookingAdvice: "Use the exhaust fan.",
    ventilationWindow: "Open windows from 14:00 to 16:00.",
    purifierStrategy: "Run it in the bedroom at night.",
    hazardWarnings: ["Skip incense."],
  },
  communityTip: "Ask the society to stop leaf burning.",
  memberChanges: [{ memberId: "m1", changes: ["Wear an N95 on the metro."] }],
};

const profile = makeProfile();
const airQuality = makeAirQuality();
const facts = computeEngineFacts(profile, airQuality);

function reply(value: unknown) {
  generateContent.mockResolvedValue({
    text: typeof value === "string" ? value : JSON.stringify(value),
  });
}

beforeEach(() => {
  generateContent.mockReset();
  aiPlanCache.clear();
  aiTextCache.clear();
  vi.stubEnv("GEMINI_API_KEY", "test-key");
  vi.stubEnv("GEMINI_MODEL", "gemini-test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("generateOptimizedPlanWithGemini", () => {
  it("refuses to write a plan without an API key and never calls the service", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(generateOptimizedPlanWithGemini(profile, airQuality, facts)).rejects.toMatchObject(
      { reason: "missing_key" }
    );
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("treats the placeholder key from .env.example as no key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "your_gemini_api_key_here");
    await expect(generateOptimizedPlanWithGemini(profile, airQuality, facts)).rejects.toMatchObject(
      { reason: "missing_key" }
    );
  });

  it("ignores spaces and a Windows line ending around the key", async () => {
    vi.stubEnv("GEMINI_API_KEY", " test-key\r ");
    reply(validOutput);
    await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("returns a plan in the exact shape the browser expects", async () => {
    reply(validOutput);
    const plan = await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    expect(plan.isFallback).toBe(false);
    expect(DailyPlanResponseSchema.safeParse(plan).success).toBe(true);
  });

  it("takes every number from the engine, not from the model", async () => {
    reply(validOutput);
    const plan = await generateOptimizedPlanWithGemini(profile, airQuality, facts);

    const at7 = airQuality.hourly.find((h) => h.hour === 7)!;
    const seven = plan.schedule.find((s) => s.hour === 7)!;
    expect(seven.normalAQI).toBe(at7.aqi);
    expect(seven.optimizedAQI).not.toBe(1);
    expect(seven.optimizedAQI).toBeLessThanOrEqual(at7.aqi);

    expect(plan.memberImpacts.map((m) => m.exposureAvoidedPercentage)).toEqual(
      facts.memberImpacts.map((m) => m.exposureAvoidedPercentage)
    );
    expect(plan.emissionImpact).toEqual(facts.emissionImpact);
    expect(plan.currentAQI).toBe(airQuality.aqi);
  });

  it("uses the model's words for tips and member changes", async () => {
    reply(validOutput);
    const plan = await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    expect(plan.summary).toBe(validOutput.summary);
    expect(plan.safeWindows.find((w) => w.activity === "exercise")?.recommendation).toBe(
      "Walk in the early afternoon."
    );
    expect(plan.memberImpacts[0].keyChanges).toEqual(["Wear an N95 on the metro."]);
  });

  it("sorts the schedule by hour", async () => {
    reply({ ...validOutput, schedule: [...validOutput.schedule].reverse() });
    const plan = await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    const hours = plan.schedule.map((s) => s.hour);
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
  });

  it("asks for structured JSON with a separate system instruction", async () => {
    reply(validOutput);
    await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    const call = generateContent.mock.calls[0][0];
    expect(call.model).toBe("gemini-test");
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.config.responseJsonSchema).toBeDefined();
    expect(call.config.systemInstruction).toBeTruthy();
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["a reply that is not JSON", "this is not json"],
    ["a reply with a missing field", { ...validOutput, summary: undefined }],
    [
      "a reply with too few schedule items",
      { ...validOutput, schedule: validOutput.schedule.slice(0, 1) },
    ],
    [
      "a reply with an unknown action type",
      {
        ...validOutput,
        schedule: validOutput.schedule.map((s) => ({ ...s, actionType: "teleport" })),
      },
    ],
    ["an empty reply", ""],
  ])("refuses %s rather than inventing a plan", async (_label, value) => {
    reply(value);
    await expect(generateOptimizedPlanWithGemini(profile, airQuality, facts)).rejects.toMatchObject(
      { reason: "bad_output" }
    );
  });

  it("names the reason when the service throws, and logs no household details", async () => {
    generateContent.mockRejectedValue(Object.assign(new Error("server error"), { status: 503 }));
    await expect(generateOptimizedPlanWithGemini(profile, airQuality, facts)).rejects.toMatchObject(
      { reason: "service_error" }
    );

    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("service_error");
    expect(logged).not.toContain("Sunita");
    expect(logged).not.toContain("test-key");
  });

  it("reuses the plan for an identical request", async () => {
    reply(validOutput);
    await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("never gives one household another household's plan", async () => {
    reply(validOutput);
    const other = makeProfile({
      members: [makeMember({ id: "z1", name: "Someone Else", commuteMode: "bus" })],
    });
    const first = await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    const second = await generateOptimizedPlanWithGemini(
      other,
      airQuality,
      computeEngineFacts(other, airQuality)
    );

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(first.memberImpacts.map((m) => m.memberName)).toContain("Sunita");
    expect(second.memberImpacts.map((m) => m.memberName)).toEqual(["Someone Else"]);
  });

  it("gives a different cache key for a different language, household or air", () => {
    const base = planCacheKey(profile, airQuality);
    expect(planCacheKey({ ...profile, language: "hi" }, airQuality)).not.toBe(base);
    expect(planCacheKey({ ...profile, hasAirPurifier: true }, airQuality)).not.toBe(base);
    expect(planCacheKey(profile, makeAirQuality({ hourly: makeHourly(6, 24, () => 30) }))).not.toBe(
      base
    );
    expect(planCacheKey(profile, airQuality)).toBe(base);
  });
});

describe("finalizeGeminiPlan", () => {
  it("still returns a valid plan when an hour is missing from the data", () => {
    const sparse = makeAirQuality({ hourly: makeHourly(6, 12) });
    const plan = finalizeGeminiPlan(
      { ...validOutput, schedule: validOutput.schedule } as never,
      profile,
      sparse,
      computeEngineFacts(profile, sparse)
    );
    expect(DailyPlanResponseSchema.safeParse(plan).success).toBe(true);
  });
});

describe("text answers", () => {
  const outcome = (() => {
    const result = runWhatIf(profile, airQuality.hourly, "What if I take the metro?", "m1");
    if (!result.matched) throw new Error("expected a match");
    return result;
  })();
  const whatIfArgs = {
    question: "What if I take the metro?",
    profile,
    outcome,
    aqi: 250,
    category: "Very Poor",
    language: "en" as const,
  };

  it("returns trimmed text and reuses it", async () => {
    generateContent.mockResolvedValue({ text: "  Metro saves emissions.  " });
    expect(await generateWhatIfAnswerWithGemini(whatIfArgs)).toBe("Metro saves emissions.");
    await generateWhatIfAnswerWithGemini(whatIfArgs);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("caps very long answers", async () => {
    generateContent.mockResolvedValue({ text: "x".repeat(10_000) });
    const text = await generateWhatIfAnswerWithGemini(whatIfArgs);
    expect(text!.length).toBeLessThanOrEqual(2500);
  });

  it("refuses empty answers and reports failures, with no built-in wording", async () => {
    generateContent.mockResolvedValueOnce({ text: "   " });
    await expect(generateWhatIfAnswerWithGemini(whatIfArgs)).rejects.toBeInstanceOf(
      GeminiUnavailableError
    );

    generateContent.mockRejectedValueOnce(Object.assign(new Error("denied"), { status: 403 }));
    await expect(
      generateWhatIfAnswerWithGemini({ ...whatIfArgs, question: "Another one?" })
    ).rejects.toMatchObject({ reason: "invalid_key" });
  });

  it("writes an advisory and keeps audiences apart in the cache", async () => {
    generateContent.mockResolvedValueOnce({ text: "School notice." });
    generateContent.mockResolvedValueOnce({ text: "Society notice." });
    const base = { city: "Delhi", aqi: 250, category: "Very Poor", language: "en" as const };

    expect(await generateCommunityAdvisoryWithGemini({ ...base, audience: "school" })).toBe(
      "School notice."
    );
    expect(
      await generateCommunityAdvisoryWithGemini({ ...base, audience: "housing_society" })
    ).toBe("Society notice.");
  });

  it("refuses without a key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(generateWhatIfAnswerWithGemini(whatIfArgs)).rejects.toMatchObject({
      reason: "missing_key",
    });
  });
});

describe("fallback and AI plans agree on shape", () => {
  it("both satisfy the same response schema", async () => {
    reply(validOutput);
    const ai = await generateOptimizedPlanWithGemini(profile, airQuality, facts);
    const rules = generateFallbackPlan(profile, airQuality, facts);
    expect(DailyPlanResponseSchema.safeParse(ai).success).toBe(true);
    expect(DailyPlanResponseSchema.safeParse(rules).success).toBe(true);
    expect(Object.keys(ai!).sort()).toEqual(Object.keys(rules).sort());
  });
});

describe("classifyGeminiError", () => {
  const withStatus = (status: number, message = "x") =>
    Object.assign(new Error(message), { status });

  it.each([
    [withStatus(401), "invalid_key"],
    [withStatus(403), "invalid_key"],
    [new Error("API key not valid. Please pass a valid API key."), "invalid_key"],
    [withStatus(429), "quota"],
    [new Error("RESOURCE_EXHAUSTED: quota exceeded"), "quota"],
    [withStatus(404), "model_not_found"],
    [withStatus(500), "service_error"],
    [withStatus(503), "service_error"],
    [new DOMException("The operation timed out.", "TimeoutError"), "timeout"],
    [Object.assign(new Error("aborted"), { name: "AbortError" }), "timeout"],
    [new TypeError("fetch failed"), "network"],
    [new SyntaxError("Unexpected token"), "bad_output"],
    [new Error("something else"), "unknown"],
    ["not an error object", "unknown"],
  ])("maps %j to one reason", (err, reason) => {
    expect(classifyGeminiError(err)).toBe(reason);
  });

  it("keeps the reason of an error that is already classified", () => {
    expect(classifyGeminiError(new GeminiUnavailableError("quota"))).toBe("quota");
  });
});
