/**
 * Quality and color mapping utilities for consistent UI styling
 * Consolidates repeated quality/color mapping patterns
 */

import type { ImagingWindow } from '@/types';

/**
 * Get CSS color class for imaging quality rating
 *
 * Color Scale (Worst → Best):
 * - Poor: blue-400
 * - Acceptable: orange-400
 * - Good: yellow-400
 * - Excellent: green-400
 */
export function getImagingQualityColorClass(quality: ImagingWindow['quality']): string {
  switch (quality) {
    case 'excellent':
      return 'text-green-400';
    case 'good':
      return 'text-yellow-400';
    case 'acceptable':
      return 'text-orange-400';
    case 'poor':
      return 'text-blue-400';
  }
}

/**
 * Get CSS color class for dew risk level based on temperature margin
 */
export function getDewRiskColorClass(margin: number): string {
  if (margin < 2) return 'bg-red-500/60';
  if (margin < 4) return 'bg-orange-500/40';
  if (margin < 6) return 'bg-yellow-500/40';
  return 'bg-green-500/40';
}

/**
 * Get dew risk level from temperature-dewpoint margin
 */
export function getDewRiskLevel(margin: number): 'safe' | 'low' | 'moderate' | 'high' {
  if (margin < 2) return 'high';
  if (margin < 4) return 'moderate';
  if (margin < 6) return 'low';
  return 'safe';
}

/**
 * Get CSS color class for seeing forecast rating
 *
 * Color Scale (Worst → Best):
 * - Poor: blue-400
 * - Fair: red-400
 * - Good: orange-400
 * - Excellent: green-400
 */
export function getSeeingForecastColorClass(
  rating: 'excellent' | 'good' | 'fair' | 'poor'
): string {
  switch (rating) {
    case 'excellent':
      return 'text-green-400';
    case 'good':
      return 'text-orange-400';
    case 'fair':
      return 'text-red-400';
    case 'poor':
      return 'text-blue-400';
  }
}

/**
 * Get CSS color class for cloud cover percentage
 *
 * Color Scale (Best → Worst for clouds):
 * - <20% (clear): green-400
 * - <40%: yellow-400
 * - <60%: orange-400
 * - <80%: red-400
 * - >=80%: blue-400 (worst)
 */
export function getCloudCoverColorClass(cloudCover: number): string {
  if (cloudCover < 20) return 'text-green-400';
  if (cloudCover < 40) return 'text-yellow-400';
  if (cloudCover < 60) return 'text-orange-400';
  if (cloudCover < 80) return 'text-red-400';
  return 'text-blue-400';
}

/**
 * Get CSS color class for transparency score
 *
 * Color Scale (Worst → Best):
 * - <40% (poor): blue-400
 * - <60%: red-400
 * - <80%: orange-400
 * - >=80% (excellent): green-400
 */
export function getTransparencyColorClass(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-orange-400';
  if (score >= 40) return 'text-red-400';
  return 'text-blue-400';
}
