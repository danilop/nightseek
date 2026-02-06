/**
 * Centralized color utilities for consistent status-based styling
 * Consolidates color logic that was previously scattered across components
 */

export type QualityLevel = 'excellent' | 'good' | 'fair' | 'poor';

/**
 * Get Tailwind background color class for quality levels
 */
export function getQualityBgColor(level: QualityLevel): string {
  switch (level) {
    case 'excellent':
      return 'bg-green-500';
    case 'good':
      return 'bg-yellow-500';
    case 'fair':
      return 'bg-orange-500';
    case 'poor':
      return 'bg-red-500';
  }
}

/**
 * Get text color for altitude values (used in meteor showers, satellite passes)
 * Higher altitude = better visibility
 */
export function getAltitudeTextColor(altitude: number): string {
  if (altitude < 0) return 'text-red-400';
  if (altitude < 30) return 'text-amber-400';
  if (altitude < 60) return 'text-green-400';
  return 'text-emerald-400';
}

/**
 * Get moon interference level, color, and descriptive text
 * Used for meteor showers and other astronomical observations
 */
export function getMoonInterference(illumination: number | null): {
  level: 'none' | 'low' | 'moderate' | 'high';
  text: string;
  textColor: string;
} {
  if (illumination === null || illumination < 25) {
    return { level: 'none', text: 'Minimal interference', textColor: 'text-green-400' };
  }
  if (illumination < 50) {
    return { level: 'low', text: 'Some interference', textColor: 'text-yellow-400' };
  }
  if (illumination < 75) {
    return { level: 'moderate', text: 'Moderate interference', textColor: 'text-amber-400' };
  }
  return { level: 'high', text: 'Significant interference', textColor: 'text-red-400' };
}
