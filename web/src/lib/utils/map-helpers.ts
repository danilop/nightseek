/**
 * Utility functions for safe Map access that eliminate non-null assertions
 */

/**
 * Get a required value from a Map, throwing if not found
 * @throws Error if the key is not present in the map
 */
export function getRequired<K, V>(map: Map<K, V>, key: K, context?: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(`Missing required map key: ${String(key)}${context ? ` (${context})` : ''}`);
  }
  return value;
}

/**
 * Get a value from a Map, returning null if not found
 */
export function getOrNull<K, V>(map: Map<K, V>, key: K): V | null {
  return map.get(key) ?? null;
}

/**
 * Get a value from a Map, returning a default if not found
 */
export function getOrDefault<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
  return map.get(key) ?? defaultValue;
}
