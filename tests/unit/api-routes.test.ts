import { NextRequest } from "next/server";
import { DailyPlanResponseSchema } from "@/ai/schemas";
import { generateFallbackPlan } from "@/domain/rules-fallback";
import { computeEngineFacts } from "@/domain/engine";
import { resetRateLimits } from "@/lib/rate-limiter";
import { makeAirQuality, makeProfile } from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({
  resolveAirQuality: vi.fn(),
  generatePlan: vi.fn(),
  generateWhatIf: vi.fn(),
  generateAdvisory: vi.fn(),
}));

vi.mock("@/lib/air-quality-service", () => ({ resolveAirQuality: mocks.resolveAirQuality }));
vi.mock("@/ai/gemini", () => ({
  generateOptimizedPlanWithGemini: mocks.generatePlan,
  generateWhatIfAnswerWithGemini: mocks.generateWhatIf,
  generateCommunityAdvisoryWithGemini: mocks.generateAdvisory,
}));

import { POST as advisoryPOST } from "@/app/api/advisory/route";
import { POST as planPOST } from "@/app/api/plan/route";
import { POST as whatifPOST } from "@/app/api/whatif/route";

const airQuality = makeAirQuality();
const profile = makeProfile();

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1", ...headers },
  });
}

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv("RATE_LIMIT_PER_MINUTE", "100");
  mocks.resolveAirQuality.mockReset().mockResolvedValue({ ok: true, airQuality });
  mocks.generatePlan.mockReset().mockResolvedValue(null);
  mocks.generateWhatIf.mockReset().mockResolvedValue(null);
  mocks.generateAdvisory.mockReset().mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("shared protections", () => {
  const routes = [
    ["/api/plan", planPOST, profile],
    ["/api/whatif", whatifPOST, { profile, question: "What if I cycle?" }],
    ["/api/advisory", advisoryPOST, { city: "Delhi", audience: "school" }],
  ] as const;

  it.each(routes)("%s rejects a body that is not JSON", async (path, handler) => {
    const res = await handler(post(path, "{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_json");
  });

  it.each(routes)("%s rejects an oversized body", async (path, handler) => {
    const res = await handler(post(path, { pad: "x".repeat(40_000) }));
    expect(res.status).toBe(413);
    expect((await res.json()).code).toBe("payload_too_large");
  });

  it.each(routes)("%s never lets the browser cache the answer", async (path, handler, body) => {
    const res = await handler(post(path, body));
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it.each(routes)("%s limits how often one caller can ask", async (path, handler, body) => {
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "2");
    expect((await handler(post(path, body))).status).toBe(200);
    expect((await handler(post(path, body))).status).toBe(200);
    const limited = await handler(post(path, body));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await limited.json()).code).toBe("rate_limited");

    // Someone else is not affected.
    const other = await handler(post(path, body, { "x-forwarded-for": "10.0.0.2" }));
    expect(other.status).toBe(200);
  });

  it.each(routes)("%s hides internal errors", async (path, handler, body) => {
    mocks.resolveAirQuality.mockRejectedValue(new Error("secret database detail"));
    const res = await handler(post(path, body));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("internal_error");
    expect(text).not.toContain("secret database detail");
  });

  it.each(routes)("%s reports an unknown city as 404", async (path, handler, body) => {
    mocks.resolveAirQuality.mockResolvedValue({ ok: false, reason: "city_not_found" });
    const res = await handler(post(path, body));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("city_not_found");
  });
});

describe("POST /api/plan", () => {
  it("returns the rule-based plan when the AI service gives nothing", async () => {
    const res = await planPOST(post("/api/plan", profile));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isFallback).toBe(true);
    expect(DailyPlanResponseSchema.safeParse(body).success).toBe(true);
  });

  it("returns the AI plan when there is one", async () => {
    const aiPlan = { ...generateFallbackPlan(profile, airQuality), isFallback: false };
    mocks.generatePlan.mockResolvedValue(aiPlan);
    const body = await (await planPOST(post("/api/plan", profile))).json();
    expect(body.isFallback).toBe(false);
  });

  it("gives the AI the engine's numbers, not numbers from the browser", async () => {
    await planPOST(
      post("/api/plan", { ...profile, currentAQI: 1, airQuality: { aqi: 1, hourly: [] } })
    );
    const [, passedAirQuality, passedFacts] = mocks.generatePlan.mock.calls[0];
    expect(passedAirQuality).toBe(airQuality);
    expect(passedFacts).toEqual(computeEngineFacts(profile, airQuality));
  });

  it("reports the plan's own air quality, even if the browser claimed another", async () => {
    const body = await (
      await planPOST(post("/api/plan", { ...profile, currentAQI: 1 }))
    ).json();
    expect(body.currentAQI).toBe(airQuality.aqi);
  });

  it("answers invalid input with field names only", async () => {
    const bad = { ...profile, city: "A", members: [] };
    const res = await planPOST(post("/api/plan", bad));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_request");
    expect(body.details.map((d: { field: string }) => d.field)).toEqual(
      expect.arrayContaining(["city", "members"])
    );
    expect(mocks.resolveAirQuality).not.toHaveBeenCalled();
  });

  it("looks the air up by city name from the server", async () => {
    await planPOST(post("/api/plan", profile));
    expect(mocks.resolveAirQuality).toHaveBeenCalledWith("New Delhi", undefined);
  });
});

describe("POST /api/whatif", () => {
  it("recalculates first, then adds the AI explanation", async () => {
    mocks.generateWhatIf.mockResolvedValue("Metro is cleaner.");
    const res = await whatifPOST(
      post("/api/whatif", { profile, question: "What if I take the metro?", memberId: "m1" })
    );
    const body = await res.json();
    expect(body.matched).toBe(true);
    expect(body.toMode).toBe("metro");
    expect(body.explanation).toBe("Metro is cleaner.");
    expect(body.explanationSource).toBe("gemini");
    expect(body.currentAQI).toBe(airQuality.aqi);
  });

  it("explains with rules when the AI service is unavailable", async () => {
    const body = await (
      await whatifPOST(
        post("/api/whatif", { profile, question: "What if I take the metro?", memberId: "m1" })
      )
    ).json();
    expect(body.explanationSource).toBe("rules");
    expect(body.explanation).toContain("Rajesh");
  });

  it("does not call the AI when the question names no way of travelling", async () => {
    const body = await (
      await whatifPOST(post("/api/whatif", { profile, question: "Is it safe outside?" }))
    ).json();
    expect(body).toMatchObject({ matched: false, reason: "no_mode" });
    expect(mocks.generateWhatIf).not.toHaveBeenCalled();
  });

  it("rejects a question that is too short", async () => {
    const res = await whatifPOST(post("/api/whatif", { profile, question: "hi" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/advisory", () => {
  it("returns the AI's advisory", async () => {
    mocks.generateAdvisory.mockResolvedValue("School notice.");
    const body = await (
      await advisoryPOST(post("/api/advisory", { city: "Delhi", audience: "school" }))
    ).json();
    expect(body).toMatchObject({
      advisoryText: "School notice.",
      advisorySource: "gemini",
      audience: "school",
      dataSource: "open-meteo",
    });
  });

  it("falls back to a rule-based advisory", async () => {
    const body = await (
      await advisoryPOST(post("/api/advisory", { city: "Delhi", audience: "housing_society" }))
    ).json();
    expect(body.advisorySource).toBe("rules");
    expect(body.advisoryText).toContain(String(airQuality.aqi));
  });

  it("says when the data is modelled", async () => {
    mocks.resolveAirQuality.mockResolvedValue({
      ok: true,
      airQuality: makeAirQuality({ dataSource: "modelled" }),
    });
    const body = await (
      await advisoryPOST(post("/api/advisory", { city: "Delhi", audience: "school" }))
    ).json();
    expect(body.dataSource).toBe("modelled");
  });

  it("rejects an unknown audience", async () => {
    const res = await advisoryPOST(post("/api/advisory", { city: "Delhi", audience: "all" }));
    expect(res.status).toBe(400);
  });
});
