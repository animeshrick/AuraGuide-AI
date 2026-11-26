import { afterEach, describe, expect, it, vi } from "vitest";
import { readServerEnv } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readServerEnv", () => {
  it("returns trimmed values that are set", () => {
    vi.stubEnv("GEMINI_API_KEY", "  key-123  ");
    vi.stubEnv("GEMINI_MODEL", "model-a");
    vi.stubEnv("GEMINI_MODEL_2", "model-b");
    vi.stubEnv("GEMINI_MODEL_3", "model-c");
    vi.stubEnv("GEMINI_RETRY_BASE_MS", "250");
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "12");

    expect(readServerEnv()).toEqual({
      geminiApiKey: "key-123",
      geminiModels: ["model-a", "model-b", "model-c"],
      geminiRetryBaseMs: 250,
      rateLimitPerMinute: 12,
    });
  });

  it("treats a blank value as not set", () => {
    vi.stubEnv("GEMINI_API_KEY", "   ");
    vi.stubEnv("GEMINI_MODEL", "");
    vi.stubEnv("GEMINI_RETRY_BASE_MS", "");

    const env = readServerEnv();

    expect(env.geminiApiKey).toBeUndefined();
    expect(env.geminiModels[0]).toBeUndefined();
    expect(env.geminiRetryBaseMs).toBeUndefined();
  });

  it("accepts a retry wait of zero, which tests use to skip the wait", () => {
    vi.stubEnv("GEMINI_RETRY_BASE_MS", "0");
    expect(readServerEnv().geminiRetryBaseMs).toBe(0);
  });

  it.each(["abc", "-5", "1.5", "0"])("ignores a rate limit of %s", (value) => {
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", value);
    expect(readServerEnv().rateLimitPerMinute).toBeUndefined();
  });
});
