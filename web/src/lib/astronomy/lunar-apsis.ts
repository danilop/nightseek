import * as Astronomy from 'astronomy-engine';
import type { LunarApsis, NightInfo } from '@/types';

const MEAN_LUNAR_DISTANCE_KM = 384400;

// “Supermoon” has no formal IAU definition. Nightseek uses the explicit,
// reproducible criterion that exact perigee and exact full moon are <=24h apart.
const PERIGEE_FULL_MOON_WINDOW_HOURS = 24;

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
export function isPerigeeFullMoon(perigeeDate: Date): boolean {
  const searchStart = new Date(perigeeDate.getTime() - 16 * 86_400_000);
  const fullMoon = Astronomy.SearchMoonPhase(180, searchStart, 32);
  if (!fullMoon) return false;
  const separationHours = Math.abs(fullMoon.date.getTime() - perigeeDate.getTime()) / 3_600_000;
  return separationHours <= PERIGEE_FULL_MOON_WINDOW_HOURS;
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

    const supermoon = apsis.type === 'perigee' && isPerigeeFullMoon(apsis.date);

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
    return `Perigee full moon (${distanceStr} km) - exact full moon occurs within 24 hours (often called a supermoon)`;
  }

  if (apsis.type === 'perigee') {
    const percentLarger = ((MEAN_LUNAR_DISTANCE_KM / apsis.distanceKm - 1) * 100).toFixed(1);
    return `Moon at perigee (${distanceStr} km) - appears ${percentLarger}% larger than at its mean distance`;
  }

  const percentSmaller = ((1 - MEAN_LUNAR_DISTANCE_KM / apsis.distanceKm) * 100).toFixed(1);
  return `Moon at apogee (${distanceStr} km) - appears ${percentSmaller}% smaller than at its mean distance`;
}
