/**
 * In-memory cache for URL screening results.
 * Key: canonicalUrl. TTL: ok=24h, non-ok=2h, rate-limited=30m.
 */

export type CachedScreen = { ts: number; ttlMs: number; value: unknown };

const cache = new Map<string, CachedScreen>();

export function getCached(key: string): unknown {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > entry.ttlMs) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCached(key: string, value: unknown, ttlMs: number): void {
  cache.set(key, { ts: Date.now(), ttlMs, value });
}

export const TTL_OK_MS = 24 * 60 * 60 * 1000;
export const TTL_NON_OK_MS = 2 * 60 * 60 * 1000;
export const TTL_RATE_LIMITED_MS = 30 * 60 * 1000;
