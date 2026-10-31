import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '@/lib/utils/cache';
import type { TLEData } from '@/types';

const ISS_NORAD_ID = 25544;
const CELESTRAK_BASE = 'https://celestrak.org/NORAD/elements/gp.php';

/** Fetch modern OMM JSON; NORAD IDs are not limited to five digits. */
async function fetchElements(query: string, key: string): Promise<TLEData[]> {
  const cached = await getCached<TLEData[]>(key, CACHE_TTLS.TLE);
  if (cached) return cached;
  try {
    const response = await fetch(`${CELESTRAK_BASE}?${query}&FORMAT=JSON`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return [];
    const elements = parseOMM(await response.json());
    if (elements.length) await setCache(key, elements);
    return elements;
  } catch {
    return [];
  }
}

export async function fetchISSTLE(): Promise<TLEData | null> {
  return (await fetchElements(`CATNR=${ISS_NORAD_ID}`, CACHE_KEYS.TLE_ISS))[0] ?? null;
}

export function parseOMM(raw: unknown): TLEData[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const required = [
      'NORAD_CAT_ID',
      'MEAN_MOTION',
      'ECCENTRICITY',
      'INCLINATION',
      'RA_OF_ASC_NODE',
      'ARG_OF_PERICENTER',
      'MEAN_ANOMALY',
      'BSTAR',
      'MEAN_MOTION_DOT',
      'MEAN_MOTION_DDOT',
      'ELEMENT_SET_NO',
    ];
    const epochDate = new Date(
      typeof row.EPOCH === 'string' ? `${row.EPOCH.replace(/Z$/, '')}Z` : ''
    );
    const epoch = Number.isFinite(epochDate.getTime()) ? epochDate.toISOString() : '';
    if (
      !epoch ||
      typeof row.OBJECT_NAME !== 'string' ||
      required.some(key => row[key] == null || !Number.isFinite(Number(row[key])))
    )
      return [];
    if (
      Number(row.MEAN_MOTION) <= 0 ||
      Number(row.ECCENTRICITY) < 0 ||
      Number(row.ECCENTRICITY) >= 1
    )
      return [];
    return [
      {
        name: row.OBJECT_NAME,
        noradId: Number(row.NORAD_CAT_ID),
        line1: '',
        line2: '',
        omm: row,
        epoch,
      },
    ];
  });
}

/**
 * Parse raw TLE text into TLEData array.
 * TLE format: 3 lines per satellite (name, line1, line2).
 */
export function parseTLEText(text: string): TLEData[] {
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

/** Cached for a day, comfortably below CelesTrak's two-hour update cadence. */
export function fetchBrightSatelliteTLEs(): Promise<TLEData[]> {
  return fetchElements('GROUP=visual', CACHE_KEYS.TLE_BRIGHT);
}
