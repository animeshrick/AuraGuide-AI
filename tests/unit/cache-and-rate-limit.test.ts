import { MemoryCache } from "@/lib/cache";
import { checkRateLimit, pruneRateLimits, resetRateLimits } from "@/lib/rate-limiter";

describe("MemoryCache", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns a stored value until it expires", () => {
    const cache = new MemoryCache();
    cache.set("k", { a: 1 }, 1000);
    expect(cache.get("k")).toEqual({ a: 1 });
    vi.advanceTimersByTime(1001);
    expect(cache.get("k")).toBeNull();
  });

  it("returns null for a key that was never set", () => {
    expect(new MemoryCache().get("missing")).toBeNull();
  });

  it("drops the oldest entries once it is full", () => {
    const cache = new MemoryCache(2);
    cache.set("a", 1, 10_000);
    cache.set("b", 2, 10_000);
    cache.set("c", 3, 10_000);
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("treats a re-set key as the newest", () => {
    const cache = new MemoryCache(2);
    cache.set("a", 1, 10_000);
    cache.set("b", 2, 10_000);
    cache.set("a", 11, 10_000);
    cache.set("c", 3, 10_000);
    expect(cache.get("a")).toBe(11);
    expect(cache.get("b")).toBeNull();
  });

  it("counts only live entries and can be cleared", () => {
    const cache = new MemoryCache();
    cache.set("short", 1, 100);
    cache.set("long", 2, 10_000);
    vi.advanceTimersByTime(500);
    expect(cache.size()).toBe(1);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});

describe("checkRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("allows requests up to the limit, then blocks", () => {
    expect(checkRateLimit("ip", 3).success).toBe(true);
    expect(checkRateLimit("ip", 3).success).toBe(true);
    const third = checkRateLimit("ip", 3);
    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = checkRateLimit("ip", 3);
    expect(blocked.success).toBe(false);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it("starts a fresh window after a minute", () => {
    for (let i = 0; i < 2; i++) checkRateLimit("ip", 2);
    expect(checkRateLimit("ip", 2).success).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit("ip", 2).success).toBe(true);
  });

  it("counts each caller separately", () => {
    checkRateLimit("a", 1);
    expect(checkRateLimit("a", 1).success).toBe(false);
    expect(checkRateLimit("b", 1).success).toBe(true);
  });

  it("reads the limit from RATE_LIMIT_PER_MINUTE", () => {
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "2");
    checkRateLimit("ip");
    checkRateLimit("ip");
    expect(checkRateLimit("ip").success).toBe(false);
  });

  it("falls back to a default when the variable is not a number", () => {
    vi.stubEnv("RATE_LIMIT_PER_MINUTE", "lots");
    for (let i = 0; i < 30; i++) expect(checkRateLimit("ip").success).toBe(true);
    expect(checkRateLimit("ip").success).toBe(false);
  });

  it("forgets callers whose window has passed", () => {
    checkRateLimit("old", 1);
    vi.advanceTimersByTime(61_000);
    pruneRateLimits();
    expect(checkRateLimit("old", 1).success).toBe(true);
  });
});
