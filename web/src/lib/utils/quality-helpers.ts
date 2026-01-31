/**
 * Quality and color mapping utilities for consistent UI styling
 * Consolidates repeated quality/color mapping patterns
 */

import type { ImagingWindow } from '@/types';

/**
 * Get CSS color class for imaging quality rating
 */
export function getImagingQualityColorClass(quality: ImagingWindow['quality']): string {
  switch (quality) {
    case 'excellent':
      return 'text-green-400';
    case 'good':
      return 'text-blue-400';
    case 'acceptable':
      return 'text-yellow-400';
    case 'poor':
      return 'text-gray-400';
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
 */
export function getSeeingForecastColorClass(
  rating: 'excellent' | 'good' | 'fair' | 'poor'
): string {
  switch (rating) {
    case 'excellent':
      return 'text-green-400';
    case 'good':
      return 'text-blue-400';
    case 'fair':
      return 'text-yellow-400';
    case 'poor':
      return 'text-red-400';
  }
}

/**
 * Get CSS color class for cloud cover percentage
 */
export function getCloudCoverColorClass(cloudCover: number): string {
  if (cloudCover < 20) return 'text-green-400';
  if (cloudCover < 40) return 'text-blue-400';
  if (cloudCover < 60) return 'text-yellow-400';
  if (cloudCover < 80) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Get CSS color class for transparency score
 */
export function getTransparencyColorClass(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-yellow-400';
  return 'text-orange-400';
}
