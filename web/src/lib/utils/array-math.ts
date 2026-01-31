/**
 * Utility functions for array mathematical operations
 * Used across weather parsing, scoring, and other calculations
 */

/**
 * Calculate the average of an array of numbers
 * Returns 0 for empty arrays
 */
export function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/**
 * Calculate the minimum value in an array
 * Returns 0 for empty arrays
 */
export function minVal(arr: number[]): number {
  return arr.length > 0 ? Math.min(...arr) : 0;
}

/**
 * Calculate the maximum value in an array
 * Returns 0 for empty arrays
 */
export function maxVal(arr: number[]): number {
  return arr.length > 0 ? Math.max(...arr) : 0;
}

/**
 * Calculate the sum of an array of numbers
 * Returns 0 for empty arrays
 */
export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/**
 * Check if an array has values and get its average, otherwise return null
 */
export function avgOrNull(arr: number[]): number | null {
  return arr.length > 0 ? avg(arr) : null;
}

/**
 * Check if an array has values and get its min, otherwise return null
 */
export function minOrNull(arr: number[]): number | null {
  return arr.length > 0 ? minVal(arr) : null;
}

/**
 * Check if an array has values and get its max, otherwise return null
 */
export function maxOrNull(arr: number[]): number | null {
  return arr.length > 0 ? maxVal(arr) : null;
}
