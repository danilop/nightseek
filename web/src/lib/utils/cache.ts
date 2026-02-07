import { del, get, keys, set } from 'idb-keyval';

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
export async function getCached<T>(key: string, maxAge: number): Promise<T | null> {
  try {
    const entry = await get<CacheEntry<T>>(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > maxAge) {
      await del(key);
      return null;
    }

    return entry.data;
  } catch (_error) {
    // Silently fail for cache operations
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
  } catch {
    // Silently fail for cache operations
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
  } catch {
    // Silently fail for cache operations
  }
}

/**
 * Clean up old versioned cache entries
 * Call this on app startup to remove stale caches from previous versions
 */
export async function cleanupOldCaches(): Promise<void> {
  try {
    const allKeys = await keys();
    const currentVersionedKeys = new Set([CACHE_KEYS.OPENGC, CACHE_KEYS.COMETS]);

    for (const key of allKeys) {
      if (typeof key !== 'string') continue;

      // Check for old versioned catalog caches (e.g., 'nightseek:opengc' or 'nightseek:opengc:v1')
      if (
        (key.startsWith('nightseek:opengc') || key.startsWith('nightseek:comets')) &&
        !currentVersionedKeys.has(key)
      ) {
        await del(key);
      }
    }
  } catch {
    // Silently fail for cache operations
  }
}

// Cache version - increment when cached data format changes or dictionaries are updated
// This ensures users get fresh data after updates to common-names, star catalogs, etc.
const CACHE_VERSION = 2;

// Cache keys (versioned keys will invalidate old caches automatically)
export const CACHE_KEYS = {
  LOCATION: 'nightseek:location', // User data - no version needed
  SETTINGS: 'nightseek:settings', // User data - no version needed
  FORECAST: 'nightseek:forecast',
  OPENGC: `nightseek:opengc:v${CACHE_VERSION}`, // Versioned - depends on common-names.ts
  COMETS: `nightseek:comets:v${CACHE_VERSION}`, // Versioned - catalog data
  WEATHER_PREFIX: 'nightseek:weather:',
  TLE_ISS: 'nightseek:tle:iss',
  GAIA_PREFIX: 'nightseek:gaia:',
  BORTLE_PREFIX: 'nightseek:bortle:',
  // New API cache keys
  NEOWS_PREFIX: 'nightseek:neows:',
  SBDB_PREFIX: 'nightseek:sbdb:',
  IAU_METEORS: 'nightseek:iau:showers',
  GAIA_ENHANCED_PREFIX: 'nightseek:gaia:enhanced:',
  DONKI: 'nightseek:donki',
};

// Cache TTLs (in milliseconds)
export const CACHE_TTLS = {
  LOCATION: Infinity, // Never expires
  SETTINGS: Infinity, // Never expires
  FORECAST: 60 * 60 * 1000, // 1 hour
  OPENGC: 7 * 24 * 60 * 60 * 1000, // 7 days
  COMETS: 24 * 60 * 60 * 1000, // 24 hours
  WEATHER: 60 * 60 * 1000, // 1 hour
  TLE: 24 * 60 * 60 * 1000, // 24 hours
  GAIA: 7 * 24 * 60 * 60 * 1000, // 7 days
  BORTLE: 30 * 24 * 60 * 60 * 1000, // 30 days
  // New API cache TTLs
  NEOWS: 12 * 60 * 60 * 1000, // 12 hours
  SBDB: 30 * 24 * 60 * 60 * 1000, // 30 days
  IAU_METEORS: 48 * 60 * 60 * 1000, // 48 hours
  GAIA_ENHANCED: 7 * 24 * 60 * 60 * 1000, // 7 days
  DONKI: 4 * 60 * 60 * 1000, // 4 hours
};
