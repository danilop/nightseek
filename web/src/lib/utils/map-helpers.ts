/**
 * Utility functions for safe Map access that eliminate non-null assertions
 */

/**
 * Get a value from a Map, returning a default if not found
 */
export function getOrDefault<K, V>(map: Map<K, V>, key: K, defaultValue: V): V {
  return map.get(key) ?? defaultValue;
}
