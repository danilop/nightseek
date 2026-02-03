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
 * Get Tailwind text color class for quality levels
 */
export function getQualityTextColor(level: QualityLevel): string {
  switch (level) {
    case 'excellent':
      return 'text-green-400';
    case 'good':
      return 'text-yellow-400';
    case 'fair':
      return 'text-orange-400';
    case 'poor':
      return 'text-red-400';
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
 * Get text color for distance values (lower is more notable)
 * Used for asteroid close approaches
 */
export function getDistanceTextColor(lunarDistances: number): string {
  if (lunarDistances < 1) return 'text-red-400';
  if (lunarDistances < 5) return 'text-amber-400';
  if (lunarDistances < 20) return 'text-yellow-400';
  return 'text-gray-400';
}

/**
 * Get text color for magnitude values (brightness)
 * Lower magnitude = brighter = better
 */
export function getMagnitudeTextColor(magnitude: number): string {
  if (magnitude < 0) return 'text-green-400'; // Very bright
  if (magnitude < 2) return 'text-yellow-400'; // Easily visible
  if (magnitude < 4) return 'text-gray-300'; // Visible
  return 'text-gray-500'; // Dim
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

/**
 * Get visibility status color based on satellite pass magnitude
 */
export function getVisibilityStatusColor(magnitude: number): string {
  if (magnitude < -2) return 'text-green-400'; // Excellent
  if (magnitude < 0) return 'text-yellow-400'; // Good
  if (magnitude < 2) return 'text-gray-300'; // Fair
  return 'text-gray-500'; // Poor
}
