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
function searchNextLunarApsis(
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
  } catch (_error) {
    return null;
  }
}

/**
 * Check if a full moon coincides with perigee (supermoon condition)
 */
function isSupermoon(perigeeDate: Date, perigeeDistanceKm: number): boolean {
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
  } catch (_error) {
    return null;
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
    const percentCloser = (
      ((MEAN_APOGEE_KM - apsis.distanceKm) / (MEAN_APOGEE_KM - MEAN_PERIGEE_KM)) *
      100
    ).toFixed(0);
    return `Moon at perigee (${distanceStr} km) - appears ${percentCloser}% larger than average`;
  }

  return `Moon at apogee (${distanceStr} km) - appears smaller than average`;
}
