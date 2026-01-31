import * as Astronomy from 'astronomy-engine';
import type { LunarLibration } from '@/types';

// Thresholds for notable libration
const NOTABLE_LIBRATION_DEG = 5;

/**
 * Calculate lunar libration at a given time
 * Libration allows us to see slightly around the edges of the Moon
 */
export function calculateLibration(date: Date): LunarLibration {
  try {
    const libration = Astronomy.Libration(date);

    // Determine description based on libration values
    const description = describeLibration(libration.elat, libration.elon);

    return {
      longitudeDeg: libration.elon,
      latitudeDeg: libration.elat,
      description,
    };
  } catch (error) {
    console.warn('Failed to calculate libration:', error);
    return {
      longitudeDeg: 0,
      latitudeDeg: 0,
      description: 'Unknown',
    };
  }
}

/**
 * Generate human-readable description of libration
 */
function describeLibration(latDeg: number, lonDeg: number): string {
  const parts: string[] = [];

  // Check longitude libration (east-west)
  if (Math.abs(lonDeg) >= NOTABLE_LIBRATION_DEG) {
    if (lonDeg > 0) {
      parts.push('eastern limb favored');
    } else {
      parts.push('western limb favored');
    }
  }

  // Check latitude libration (north-south)
  if (Math.abs(latDeg) >= NOTABLE_LIBRATION_DEG) {
    if (latDeg > 0) {
      parts.push('north pole region visible');
    } else {
      parts.push('south pole region visible');
    }
  }

  if (parts.length === 0) {
    return 'Minimal libration';
  }

  return parts.join(', ').replace(/^./, s => s.toUpperCase());
}

/**
 * Get libration info for lunar photography optimization
 */
export function getLibrationForNight(date: Date): LunarLibration {
  // Calculate at midnight
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);

  return calculateLibration(midnight);
}

/**
 * Check if libration is notable (good for specific feature observation)
 */
export function isNotableLibration(libration: LunarLibration): boolean {
  return (
    Math.abs(libration.longitudeDeg) >= NOTABLE_LIBRATION_DEG ||
    Math.abs(libration.latitudeDeg) >= NOTABLE_LIBRATION_DEG
  );
}

/**
 * Get lunar features that might be better visible due to libration
 */
export function getLibrationHighlights(libration: LunarLibration): string[] {
  const highlights: string[] = [];

  // Eastern limb features
  if (libration.longitudeDeg >= 5) {
    highlights.push('Mare Marginis');
    highlights.push('Mare Smythii (edge visible)');
  }

  // Western limb features
  if (libration.longitudeDeg <= -5) {
    highlights.push('Mare Orientale (partial view)');
    highlights.push('Grimaldi crater');
  }

  // North pole region
  if (libration.latitudeDeg >= 5) {
    highlights.push('Peary crater region');
    highlights.push('North polar features');
  }

  // South pole region
  if (libration.latitudeDeg <= -5) {
    highlights.push('Shackleton crater region');
    highlights.push('South polar features');
  }

  return highlights;
}

/**
 * Format libration for display
 */
export function formatLibration(libration: LunarLibration): string {
  const lonDir = libration.longitudeDeg >= 0 ? 'E' : 'W';
  const latDir = libration.latitudeDeg >= 0 ? 'N' : 'S';

  return `${Math.abs(libration.longitudeDeg).toFixed(1)}° ${lonDir}, ${Math.abs(libration.latitudeDeg).toFixed(1)}° ${latDir}`;
}
