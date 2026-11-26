import { z } from "zod";

/** Text from the environment: trimmed, with a blank value treated as not set. */
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined),
  z.string().optional()
);

/** A whole number of at least `min`. Anything else is treated as not set, so the default applies. */
const optionalInt = (min: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : undefined,
    z.number().int().min(min).optional().catch(undefined)
  );

const EnvSchema = z.object({
  GEMINI_API_KEY: optionalText,
  GEMINI_MODEL: optionalText,
  GEMINI_MODEL_2: optionalText,
  GEMINI_MODEL_3: optionalText,
  GEMINI_RETRY_BASE_MS: optionalInt(0),
  RATE_LIMIT_PER_MINUTE: optionalInt(1),
});

/** The server's settings, typed. A value that is missing or not valid is left out. */
export interface ServerEnv {
  geminiApiKey?: string;
  /** Model 1, then the two fallbacks, in the order they are tried. */
  geminiModels: readonly [string | undefined, string | undefined, string | undefined];
  /** Wait before the first Gemini retry, in milliseconds. */
  geminiRetryBaseMs?: number;
  rateLimitPerMinute?: number;
}

/**
 * The one place environment variables are read and validated. It reads on each
 * call, which is cheap, so a value changed at runtime or in a test is picked up.
 */
export function readServerEnv(): ServerEnv {
  const env = EnvSchema.parse(process.env);
  return {
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModels: [env.GEMINI_MODEL, env.GEMINI_MODEL_2, env.GEMINI_MODEL_3],
    geminiRetryBaseMs: env.GEMINI_RETRY_BASE_MS,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
  };
}
