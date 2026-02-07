/**
 * NASA DONKI (Space Weather Database of Notifications, Knowledge, Information)
 * https://api.nasa.gov/
 *
 * Consumes pre-fetched DONKI data (via GitHub Actions) for aurora forecasting.
 * No client-side API calls — data comes from static JSON + IndexedDB cache.
 */

import type { AuroraChance, AuroraForecast, SpaceWeather } from '@/types';
import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '../utils/cache';
import { fetchStaticData } from '../utils/static-data';

/**
 * Fetch space weather data: static JSON first, then IndexedDB cache fallback.
 */
export async function fetchSpaceWeather(): Promise<SpaceWeather | null> {
  // 1. Try pre-fetched static data
  try {
    const staticData = await fetchStaticData<SpaceWeather>('donki.json');
    if (staticData) {
      // Cache it for offline use
      await setCache(CACHE_KEYS.DONKI, staticData);
      return staticData;
    }
  } catch {
    // Static fetch failed, try cache
  }

  // 2. Fall back to IndexedDB cache
  const cached = await getCached<SpaceWeather>(CACHE_KEYS.DONKI, CACHE_TTLS.DONKI);
  if (cached) return cached;

  return null;
}

/**
 * Returns the minimum Kp index required for aurora visibility at a given latitude.
 */
function getAuroraThreshold(latitude: number): number {
  const absLat = Math.abs(latitude);
  if (absLat >= 65) return 3;
  if (absLat >= 55) return 4;
  if (absLat >= 45) return 6;
  if (absLat >= 35) return 8;
  return 9;
}

/**
 * Compute aurora forecast for a given night based on space weather and latitude.
 */
export function computeAuroraForecast(
  spaceWeather: SpaceWeather,
  nightDate: Date,
  latitude: number
): AuroraForecast {
  const requiredKp = getAuroraThreshold(latitude);

  // Find max Kp from storms on or near the night date (within ~36 hours)
  const nightMs = nightDate.getTime();
  let currentMaxKp = 0;

  for (const storm of spaceWeather.geomagneticStorms) {
    const stormTime = new Date(storm.startTime).getTime();
    const diffHours = Math.abs(nightMs - stormTime) / (1000 * 60 * 60);

    if (diffHours <= 36) {
      currentMaxKp = Math.max(currentMaxKp, storm.maxKp);
    }

    // Also check individual Kp readings
    for (const kp of storm.kpIndexes) {
      const kpTime = new Date(kp.observedTime).getTime();
      const kpDiffHours = Math.abs(nightMs - kpTime) / (1000 * 60 * 60);
      if (kpDiffHours <= 36) {
        currentMaxKp = Math.max(currentMaxKp, kp.kpIndex);
      }
    }
  }

  const diff = currentMaxKp - requiredKp;
  let chance: AuroraChance;
  let description: string;

  if (diff >= 0) {
    chance = 'certain';
    description = `Kp ${currentMaxKp} exceeds your Kp ${requiredKp} threshold — aurora highly likely!`;
  } else if (diff === -1) {
    chance = 'likely';
    description = `Kp ${currentMaxKp} is close to your Kp ${requiredKp} threshold — aurora probable.`;
  } else if (diff === -2) {
    chance = 'possible';
    description = `Kp ${currentMaxKp} approaching your Kp ${requiredKp} threshold — aurora possible if activity increases.`;
  } else if (diff === -3) {
    chance = 'unlikely';
    description = `Kp ${currentMaxKp} is below your Kp ${requiredKp} threshold — aurora unlikely.`;
  } else {
    chance = 'none';
    description =
      currentMaxKp > 0
        ? `Kp ${currentMaxKp} is well below your Kp ${requiredKp} threshold.`
        : 'No significant geomagnetic activity detected.';
  }

  return { chance, currentMaxKp, requiredKp, description };
}

/**
 * Human-readable label for geomagnetic activity level.
 */
export function getGeomagneticLabel(
  kp: number
): 'quiet' | 'unsettled' | 'active' | 'storm' | 'severe storm' {
  if (kp < 3) return 'quiet';
  if (kp < 4) return 'unsettled';
  if (kp < 5) return 'active';
  if (kp < 7) return 'storm';
  return 'severe storm';
}

/**
 * Tailwind color class based on Kp index.
 */
export function getKpColorClass(kp: number): string {
  if (kp < 2) return 'text-gray-400';
  if (kp < 3) return 'text-sky-400';
  if (kp < 4) return 'text-yellow-400';
  if (kp < 5) return 'text-amber-400';
  if (kp < 7) return 'text-orange-400';
  return 'text-red-400';
}
