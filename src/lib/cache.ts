interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  /** Oldest entries are dropped past this size so the cache cannot grow without bound. */
  constructor(private readonly maxEntries: number = 500) {}

  /**
   * Get an item from cache if it exists and hasn't expired.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set an item with a Time-To-Live (TTL) in milliseconds.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    // Re-insert so the key moves to the newest position.
    this.cache.delete(key);
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    if (this.cache.size > this.maxEntries) {
      this.prune();
      while (this.cache.size > this.maxEntries) {
        const oldest = this.cache.keys().next().value;
        if (oldest === undefined) break;
        this.cache.delete(oldest);
      }
    }
  }

  /**
   * Clear expired entries to manage memory.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all items.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get count of active keys.
   */
  size(): number {
    this.prune();
    return this.cache.size;
  }
}

// Global singletons for server runtime
export const aqiCache = new MemoryCache();
export const aiPlanCache = new MemoryCache(200);
export const aiTextCache = new MemoryCache(300);
