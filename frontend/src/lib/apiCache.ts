interface CacheEntry<T> {
  data: T;
  timestamp: number;
  key: string;
}

import { API_CACHE_TTL_MS } from '../constants';

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = API_CACHE_TTL_MS;

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now(), key });
}

export function invalidate(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const [key] of cache) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

/**
 * Wrap an async fetch function with caching.
 * Returns cached data immediately if fresh, otherwise fetches and caches.
 */
export function cached<T>(key: string, fetcher: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp <= ttl) {
    return Promise.resolve(entry.data as T);
  }
  // Expired or missing — fetch fresh
  if (entry) cache.delete(key);
  return fetcher().then(data => {
    setCache(key, data);
    return data;
  });
}
