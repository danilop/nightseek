import * as Astronomy from 'astronomy-engine';
import type { LunarLibration, NightInfo } from '@/types';

// Thresholds for notable libration
const NOTABLE_LIBRATION_DEG = 5;

/**
 * Calculate lunar libration at a given time
 * Libration allows us to see slightly around the edges of the Moon
 */
function calculateLibration(date: Date): LunarLibration {
  try {
    const libration = Astronomy.Libration(date);

    // Determine description based on libration values
    const description = describeLibration(libration.elat, libration.elon);

    return {
      longitudeDeg: libration.elon,
      latitudeDeg: libration.elat,
      description,
    };
  } catch (_error) {
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
export function getLibrationForNight(nightInfo: NightInfo): LunarLibration {
  // Use the physical midpoint of the selected observing night. Mutating
  // `setHours(0)` would instead use the browser's timezone.
  const midpoint = new Date(
    (nightInfo.astronomicalDusk.getTime() + nightInfo.astronomicalDawn.getTime()) / 2
  );
  return calculateLibration(midpoint);
}
