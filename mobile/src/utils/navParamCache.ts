/**
 * navParamCache — stash heavy objects (arrays, trackPoints, etc.) in an
 * in-memory map keyed by a short token, and pass the token through
 * navigation params instead of the raw data.
 *
 * React Navigation serializes params through the Android Intent bundle
 * which has a ~1 MB hard limit. Long walks (thousands of track points)
 * easily exceed this and trigger `TransactionTooLargeException` on native
 * side → app crash.
 *
 * Usage:
 *   const key = navParamCache.put({ routeCoords, trackPoints });
 *   navigation.navigate('Next', { _cacheKey: key });
 *   // in Next:
 *   const { routeCoords, trackPoints } = navParamCache.take(route.params?._cacheKey) || {};
 *
 * Entries auto-expire after 5 minutes so abandoned navigations don't
 * leak memory.
 */

type CacheEntry<T = any> = {
  value: T;
  expiresAt: number;
};

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const store = new Map<string, CacheEntry>();
let counter = 0;

function sweep() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt < now) store.delete(k);
  }
}

export const navParamCache = {
  put<T>(value: T): string {
    sweep();
    const key = `npc_${Date.now()}_${counter++}`;
    store.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return key;
  },
  /** Read without removing (for back-navigation where the entry may be re-used). */
  peek<T>(key: string | undefined | null): T | undefined {
    if (!key) return undefined;
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value as T;
  },
  /** Read and remove. Use this when you are sure you won't need it again. */
  take<T>(key: string | undefined | null): T | undefined {
    const v = this.peek<T>(key);
    if (key) store.delete(key);
    return v;
  },
  clear() {
    store.clear();
  },
};
