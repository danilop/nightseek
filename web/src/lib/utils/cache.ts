import { get, set, del, keys } from 'idb-keyval';

/**
 * Cache entry with timestamp
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Get cached data if not expired
 */
export async function getCached<T>(
  key: string,
  maxAge: number
): Promise<T | null> {
  try {
    const entry = await get<CacheEntry<T>>(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > maxAge) {
      await del(key);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Set cached data with current timestamp
 */
export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    await set(key, entry);
  } catch (error) {
    console.warn('Cache write error:', error);
  }
}

/**
 * Remove cached data
 */
export async function removeCache(key: string): Promise<void> {
  try {
    await del(key);
  } catch (error) {
    console.warn('Cache delete error:', error);
  }
}

/**
 * Clear all cached data for NightSeek
 */
export async function clearAllCache(): Promise<void> {
  try {
    const allKeys = await keys();
    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith('nightseek:')) {
        await del(key);
      }
    }
  } catch (error) {
    console.warn('Cache clear error:', error);
  }
}

/**
 * Prune expired cache entries
 */
export async function pruneCache(maxAges: Record<string, number>): Promise<void> {
  try {
    const allKeys = await keys();
    const now = Date.now();

    for (const key of allKeys) {
      if (typeof key !== 'string' || !key.startsWith('nightseek:')) continue;

      // Find matching max age
      let maxAge: number | null = null;
      for (const [prefix, age] of Object.entries(maxAges)) {
        if (key.startsWith(prefix)) {
          maxAge = age;
          break;
        }
      }

      if (maxAge !== null) {
        const entry = await get<CacheEntry<unknown>>(key);
        if (entry && now - entry.timestamp > maxAge) {
          await del(key);
        }
      }
    }
  } catch (error) {
    console.warn('Cache prune error:', error);
  }
}

/**
 * Get cache size estimate (in bytes)
 */
export async function getCacheSize(): Promise<number> {
  try {
    const allKeys = await keys();
    let totalSize = 0;

    for (const key of allKeys) {
      if (typeof key === 'string' && key.startsWith('nightseek:')) {
        const entry = await get(key);
        if (entry) {
          totalSize += JSON.stringify(entry).length;
        }
      }
    }

    return totalSize;
  } catch (error) {
    console.warn('Cache size error:', error);
    return 0;
  }
}

// Cache keys
export const CACHE_KEYS = {
  LOCATION: 'nightseek:location',
  SETTINGS: 'nightseek:settings',
  FORECAST: 'nightseek:forecast',
  OPENGC: 'nightseek:opengc',
  WEATHER_PREFIX: 'nightseek:weather:',
};

// Cache TTLs (in milliseconds)
export const CACHE_TTLS = {
  LOCATION: Infinity, // Never expires
  SETTINGS: Infinity, // Never expires
  FORECAST: 60 * 60 * 1000, // 1 hour
  OPENGC: 7 * 24 * 60 * 60 * 1000, // 7 days
  WEATHER: 60 * 60 * 1000, // 1 hour
};
