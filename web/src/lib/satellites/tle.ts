import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '@/lib/utils/cache';
import type { TLEData } from '@/types';

const ISS_NORAD_ID = 25544;
const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

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
    const response = await fetch(`${CELESTRAK_BASE}?CATNR=${ISS_NORAD_ID}&FORMAT=TLE`, {
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
 * Parse raw TLE text into TLEData array.
 * TLE format: 3 lines per satellite (name, line1, line2).
 */
function parseTLEText(text: string): TLEData[] {
  const lines = text.trim().split('\n');
  const results: TLEData[] = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim();
    const line1 = lines[i + 1].trim();
    const line2 = lines[i + 2].trim();

    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue;

    // Extract NORAD ID from line 1 (columns 3-7)
    const noradId = parseInt(line1.substring(2, 7).trim(), 10);
    if (Number.isNaN(noradId)) continue;

    results.push({ name, line1, line2, noradId });
  }

  return results;
}

/**
 * Fetch TLE data for the CelesTrak "visual" group (~150 brightest satellites).
 * Cached for 24 hours. Only ~20KB download.
 */
export async function fetchBrightSatelliteTLEs(): Promise<TLEData[]> {
  const cached = await getCached<TLEData[]>(CACHE_KEYS.TLE_BRIGHT, CACHE_TTLS.TLE_BRIGHT);
  if (cached) return cached;

  try {
    const response = await fetch(`${CELESTRAK_BASE}?GROUP=visual&FORMAT=TLE`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const text = await response.text();
    const tles = parseTLEText(text);

    if (tles.length > 0) {
      await setCache(CACHE_KEYS.TLE_BRIGHT, tles);
    }

    return tles;
  } catch {
    return [];
  }
}
