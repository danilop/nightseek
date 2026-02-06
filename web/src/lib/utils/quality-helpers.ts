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
