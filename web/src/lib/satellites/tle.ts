import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '@/lib/utils/cache';
import type { TLEData } from '@/types';

const ISS_NORAD_ID = 25544;
const CELESTRAK_URL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${ISS_NORAD_ID}&FORMAT=TLE`;

/**
 * Fetch ISS TLE data from Celestrak
 * Uses 24-hour cache to minimize API calls
 */
export async function fetchISSTLE(): Promise<TLEData | null> {
  // Check cache first
  const cached = await getCached<TLEData>(CACHE_KEYS.TLE_ISS, CACHE_TTLS.TLE);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(CELESTRAK_URL, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    const lines = text.trim().split('\n');

    if (lines.length < 3) {
      return null;
    }

    // Parse TLE format: name, line1, line2
    const tleData: TLEData = {
      name: lines[0].trim(),
      line1: lines[1].trim(),
      line2: lines[2].trim(),
      noradId: ISS_NORAD_ID,
    };

    // Validate TLE lines
    if (!tleData.line1.startsWith('1 ') || !tleData.line2.startsWith('2 ')) {
      return null;
    }

    // Cache the result
    await setCache(CACHE_KEYS.TLE_ISS, tleData);

    return tleData;
  } catch {
    return null;
  }
}

/**
 * Parse TLE text into TLEData object
 */
export function parseTLE(tleText: string, noradId: number): TLEData | null {
  const lines = tleText.trim().split('\n');

  if (lines.length < 3) {
    return null;
  }

  return {
    name: lines[0].trim(),
    line1: lines[1].trim(),
    line2: lines[2].trim(),
    noradId,
  };
}
