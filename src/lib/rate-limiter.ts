import { readServerEnv } from "./env";

/** Requests counted for one client in the current one-minute window. */
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const PRUNE_THRESHOLD = 1000;
const DEFAULT_LIMIT_PER_MINUTE = 30;

/** The limit to apply: the caller's, else RATE_LIMIT_PER_MINUTE, else the default. */
function resolveLimit(limitPerMinute?: number): number {
  if (limitPerMinute && limitPerMinute > 0) return limitPerMinute;
  return readServerEnv().rateLimitPerMinute ?? DEFAULT_LIMIT_PER_MINUTE;
}

/** Count one request for this caller in a fixed one-minute window. */
export function checkRateLimit(
  identifier: string,
  limitPerMinute?: number
): { success: boolean; remaining: number; resetMs: number } {
  const maxLimit = resolveLimit(limitPerMinute);
  const windowMs = 60 * 1000;
  const now = Date.now();

  // Keep memory bounded: clear expired clients once the table gets large.
  if (rateLimitMap.size > PRUNE_THRESHOLD) pruneRateLimits();

  const record = rateLimitMap.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      remaining: maxLimit - 1,
      resetMs: windowMs,
    };
  }

  if (record.count >= maxLimit) {
    return {
      success: false,
      remaining: 0,
      resetMs: record.resetTime - now,
    };
  }

  record.count += 1;
  return {
    success: true,
    remaining: maxLimit - record.count,
    resetMs: record.resetTime - now,
  };
}

/**
 * Cleanup expired rate limit tracking keys periodically.
 */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}

/** For tests: forget all clients. */
export function resetRateLimits(): void {
  rateLimitMap.clear();
}
