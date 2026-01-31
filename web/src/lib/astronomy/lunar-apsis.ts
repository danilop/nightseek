import * as Astronomy from 'astronomy-engine';
import type { LunarApsis, NightInfo } from '@/types';

// Average lunar distances (km)
const MEAN_PERIGEE_KM = 362600;
const MEAN_APOGEE_KM = 405400;

// Supermoon threshold: perigee within ~90% of closest approach
const SUPERMOON_PERIGEE_THRESHOLD_KM = 360000;

// How close to full moon (in phase degrees) for supermoon
// Full moon is at 180 degrees, we check within +/- this threshold
const FULL_MOON_PHASE_THRESHOLD = 12; // about 24 hours

/**
 * Search for the next lunar apsis (perigee or apogee)
 */
export function searchNextLunarApsis(
  startDate: Date
): { type: 'perigee' | 'apogee'; date: Date; distanceKm: number } | null {
  try {
    const result = Astronomy.SearchLunarApsis(startDate);
    if (!result) return null;

    return {
      type: result.kind === Astronomy.ApsisKind.Pericenter ? 'perigee' : 'apogee',
      date: result.time.date,
      distanceKm: result.dist_km,
    };
  } catch (error) {
    console.warn('Failed to search lunar apsis:', error);
    return null;
  }
}

/**
 * Search for the next specific apsis type
 */
export function searchNextPerigee(startDate: Date): { date: Date; distanceKm: number } | null {
  let searchDate = new Date(startDate);

  // Search up to 2 complete lunar cycles
  for (let i = 0; i < 4; i++) {
    const apsis = searchNextLunarApsis(searchDate);
    if (!apsis) return null;

    if (apsis.type === 'perigee') {
      return { date: apsis.date, distanceKm: apsis.distanceKm };
    }

    // Move search date past this apogee
    searchDate = new Date(apsis.date.getTime() + 24 * 60 * 60 * 1000);
  }

  return null;
}

/**
 * Check if a full moon coincides with perigee (supermoon condition)
 */
export function isSupermoon(perigeeDate: Date, perigeeDistanceKm: number): boolean {
  // Check if perigee is close enough
  if (perigeeDistanceKm > SUPERMOON_PERIGEE_THRESHOLD_KM) {
    return false;
  }

  // Check moon phase at perigee time
  const moonPhase = Astronomy.MoonPhase(perigeeDate);

  // Full moon is at 180 degrees
  const degreesFromFull = Math.abs(180 - moonPhase);
  const adjustedDegrees = degreesFromFull > 180 ? 360 - degreesFromFull : degreesFromFull;

  return adjustedDegrees <= FULL_MOON_PHASE_THRESHOLD;
}

/**
 * Get lunar apsis info for a specific night
 */
export function getLunarApsisForNight(
  nightInfo: NightInfo,
  windowDays: number = 3
): LunarApsis | null {
  try {
    // Search for apsis events around this night
    const searchStart = new Date(nightInfo.date);
    searchStart.setDate(searchStart.getDate() - windowDays);

    const apsis = searchNextLunarApsis(searchStart);
    if (!apsis) return null;

    // Check if this apsis is within our window
    const daysDiff = (apsis.date.getTime() - nightInfo.date.getTime()) / (1000 * 60 * 60 * 24);

    if (Math.abs(daysDiff) > windowDays) {
      return null;
    }

    const supermoon = apsis.type === 'perigee' && isSupermoon(apsis.date, apsis.distanceKm);

    return {
      type: apsis.type,
      date: apsis.date,
      distanceKm: apsis.distanceKm,
      isSupermoon: supermoon,
    };
  } catch (error) {
    console.warn('Failed to get lunar apsis for night:', error);
    return null;
  }
}

/**
 * Check if tonight is a supermoon night
 */
export function checkSupermoon(date: Date): {
  isSupermoon: boolean;
  perigeeDate: Date | null;
  distanceKm: number | null;
  fullMoonPhase: number;
} {
  try {
    const moonPhase = Astronomy.MoonPhase(date);

    // First check if we're near full moon
    const degreesFromFull = Math.abs(180 - moonPhase);
    const adjustedDegrees = degreesFromFull > 180 ? 360 - degreesFromFull : degreesFromFull;

    if (adjustedDegrees > FULL_MOON_PHASE_THRESHOLD * 2) {
      return {
        isSupermoon: false,
        perigeeDate: null,
        distanceKm: null,
        fullMoonPhase: moonPhase,
      };
    }

    // Search for nearby perigee
    const searchStart = new Date(date);
    searchStart.setDate(searchStart.getDate() - 2);

    const perigee = searchNextPerigee(searchStart);

    if (!perigee) {
      return {
        isSupermoon: false,
        perigeeDate: null,
        distanceKm: null,
        fullMoonPhase: moonPhase,
      };
    }

    const supermoon = isSupermoon(perigee.date, perigee.distanceKm);

    // Also check if this night is within 24 hours of that supermoon perigee
    const hoursDiff = Math.abs(date.getTime() - perigee.date.getTime()) / (1000 * 60 * 60);

    return {
      isSupermoon: supermoon && hoursDiff < 48,
      perigeeDate: perigee.date,
      distanceKm: perigee.distanceKm,
      fullMoonPhase: moonPhase,
    };
  } catch (error) {
    console.warn('Failed to check supermoon:', error);
    return {
      isSupermoon: false,
      perigeeDate: null,
      distanceKm: null,
      fullMoonPhase: 0,
    };
  }
}

/**
 * Get human-readable description of lunar apsis
 */
export function describeLunarApsis(apsis: LunarApsis): string {
  const distanceStr = apsis.distanceKm.toLocaleString();

  if (apsis.isSupermoon) {
    return `Supermoon! Moon at perigee (${distanceStr} km) during full moon`;
  }

  if (apsis.type === 'perigee') {
    const percentCloser = ((MEAN_APOGEE_KM - apsis.distanceKm) / (MEAN_APOGEE_KM - MEAN_PERIGEE_KM) * 100).toFixed(0);
    return `Moon at perigee (${distanceStr} km) - appears ${percentCloser}% larger than average`;
  }

  return `Moon at apogee (${distanceStr} km) - appears smaller than average`;
}
