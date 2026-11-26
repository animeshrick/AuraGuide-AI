import { GoogleGenAI } from "@google/genai";
import { readServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { classifyGeminiError, GeminiUnavailableError } from "./gemini-errors";

/** A Gemini client for the configured key. Throws `missing_key` when there is none. */
export function getClient(): GoogleGenAI {
  const apiKey = readServerEnv().geminiApiKey;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    throw new GeminiUnavailableError("missing_key", "GEMINI_API_KEY is not set");
  }
  return new GoogleGenAI({ apiKey });
}

/** Attempts per model for transient errors (503, "high demand") before moving on to the next model. */
const TRANSIENT_RETRIES = 2;
/** Stop starting new attempts after this long, so one request cannot hang for minutes. */
const TOTAL_BUDGET_MS = 60_000;
const DEFAULT_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-3.5-flash-lite"] as const;
const DEFAULT_RETRY_BASE_MS = 1_000;

/**
 * Wait before retry `attempt` (0-based): the base delay, doubled each time.
 * GEMINI_RETRY_BASE_MS changes the base, for example 0 in tests.
 */
function retryDelayMs(attempt: number): number {
  const base = readServerEnv().geminiRetryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  return base * 2 ** attempt;
}

/** Model 1, then model 2 and model 3. Set GEMINI_MODEL, GEMINI_MODEL_2 and GEMINI_MODEL_3 to change them. */
function getModelChain(): string[] {
  const [first, second, third] = readServerEnv().geminiModels;
  const chain = [
    first ?? DEFAULT_MODELS[0],
    second ?? DEFAULT_MODELS[1],
    third ?? DEFAULT_MODELS[2],
  ];
  return [...new Set(chain)];
}

/** The first model in the chain, used as part of the cache key. */
export function getModelName(): string {
  return readServerEnv().geminiModels[0] ?? DEFAULT_MODELS[0];
}

/** Errors worth retrying on the same model: overload and 5xx answers. */
function isTransient(err: unknown): boolean {
  if (classifyGeminiError(err) === "service_error") return true;
  return err instanceof Error && /high demand|UNAVAILABLE|overloaded/i.test(err.message);
}

/** Wait for `ms` milliseconds. */
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Run one request against model 1. A transient failure is retried on the same model. Any other
 * failure, or a model that stays busy, moves on to model 2 and then model 3. A bad key or a missing
 * key stops at once, because every model would fail the same way.
 */
export async function runWithFallback<T>(
  label: string,
  run: (model: string) => Promise<T>
): Promise<T> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastError: unknown = new GeminiUnavailableError("unknown", "no model was tried");
  for (const model of getModelChain()) {
    const outcome = await tryModel(label, model, run, deadline);
    if (outcome.ok) return outcome.value;
    lastError = outcome.error;
  }
  throw logFailure(label, lastError);
}

type ModelOutcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * Run one model, retrying busy answers. Returns the error to move on to the next
 * model; throws at once for a bad or missing key, or when the time budget is spent.
 */
async function tryModel<T>(
  label: string,
  model: string,
  run: (model: string) => Promise<T>,
  deadline: number
): Promise<ModelOutcome<T>> {
  let error: unknown;
  for (let attempt = 0; attempt <= TRANSIENT_RETRIES; attempt++) {
    if (Date.now() > deadline)
      throw logFailure(label, error ?? new GeminiUnavailableError("timeout"));
    try {
      return { ok: true, value: await run(model) };
    } catch (err) {
      error = err;
      const reason = classifyGeminiError(err);
      logger.error(`[gemini] ${label} model=${model} attempt=${attempt + 1} failed (${reason})`);
      if (reason === "invalid_key" || reason === "missing_key") throw logFailure(label, err);
      if (!isTransient(err) || attempt === TRANSIENT_RETRIES) break;
      await sleep(retryDelayMs(attempt));
    }
  }
  return { ok: false, error };
}

/** Log the reason and a short message. Never log prompts, keys or household details. */
function logFailure(label: string, err: unknown): GeminiUnavailableError {
  const reason = classifyGeminiError(err);
  const detail = err instanceof Error ? err.message.slice(0, 200) : "";
  logger.error(`[gemini] ${label} failed (${reason})${detail ? `: ${detail}` : ""}`);
  return new GeminiUnavailableError(reason, detail);
}
