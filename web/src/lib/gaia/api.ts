import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '@/lib/utils/cache';
import type { GaiaStar, GaiaStarField } from '@/types';

// Use VizieR TAP service which supports CORS (ESA Gaia TAP does not)
const GAIA_TAP_URL = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync';

// Max stars to return (keeps response size manageable)
const MAX_STARS = 500;
// Minimum magnitude (fainter = higher number, limit to dim stars)
const MAG_LIMIT = 14;

/**
 * Build ADQL query for cone search around coordinates
 * Uses VizieR's Gaia DR3 mirror (I/355/gaiadr3)
 */
function buildADQLQuery(raDeg: number, decDeg: number, radiusDeg: number): string {
  // VizieR column names differ slightly from ESA:
  // RAJ2000, DEJ2000, Gmag, Plx, "BP-RP"
  return `
    SELECT TOP ${MAX_STARS}
      RAJ2000 as ra, DEJ2000 as dec, Gmag as magnitude, Plx as parallax, "BP-RP" as bp_rp
    FROM "I/355/gaiadr3"
    WHERE 1=CONTAINS(
      POINT('ICRS', RAJ2000, DEJ2000),
      CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg})
    )
    AND Gmag < ${MAG_LIMIT}
    ORDER BY Gmag ASC
  `.trim();
}

/**
 * Convert RA from hours to degrees
 */
function raHoursToDegrees(raHours: number): number {
  return raHours * 15; // 360° / 24h = 15°/h
}

/**
 * Fetch star field from Gaia TAP service
 */
export async function fetchGaiaStarField(
  raHours: number,
  decDeg: number,
  radiusDeg: number = 0.5,
  objectName?: string
): Promise<GaiaStarField | null> {
  // Check cache first (use object name as key if provided)
  const cacheKey = objectName
    ? `${CACHE_KEYS.GAIA_PREFIX}${objectName.toLowerCase().replace(/\s+/g, '_')}`
    : `${CACHE_KEYS.GAIA_PREFIX}${raHours.toFixed(4)}_${decDeg.toFixed(4)}`;

  const cached = await getCached<GaiaStarField>(cacheKey, CACHE_TTLS.GAIA);
  if (cached) {
    return {
      ...cached,
      fetchedAt: new Date(cached.fetchedAt),
    };
  }

  // Convert RA to degrees
  const raDeg = raHoursToDegrees(raHours);

  // Build query
  const query = buildADQLQuery(raDeg, decDeg, radiusDeg);

  try {
    // TAP sync endpoint expects form-urlencoded data
    const params = new URLSearchParams({
      REQUEST: 'doQuery',
      LANG: 'ADQL',
      FORMAT: 'json',
      QUERY: query,
    });

    const response = await fetch(GAIA_TAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Parse VOTable JSON format
    const stars = parseGaiaResponse(data);

    // Calculate median parallax for distance estimate
    const distanceLy = calculateDistanceFromParallax(stars);

    const starField: GaiaStarField = {
      stars,
      centerRa: raDeg,
      centerDec: decDeg,
      radiusDeg,
      distanceLy,
      fetchedAt: new Date(),
    };

    // Cache the result
    await setCache(cacheKey, starField);

    return starField;
  } catch {
    return null;
  }
}

/**
 * Parse Gaia TAP JSON response into GaiaStar array
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: JSON parsing with type checking
function parseGaiaResponse(data: unknown): GaiaStar[] {
  const stars: GaiaStar[] = [];

  // Handle VOTable JSON format
  // Structure: { data: [ [ra, dec, mag, parallax, bp_rp], ... ] }
  // or: { metadata: [...], data: [...] }
  let rows: unknown[][] = [];

  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;

    if (Array.isArray(obj.data)) {
      rows = obj.data as unknown[][];
    }
  }

  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 3) continue;

    const ra = typeof row[0] === 'number' ? row[0] : null;
    const dec = typeof row[1] === 'number' ? row[1] : null;
    const magnitude = typeof row[2] === 'number' ? row[2] : null;
    const parallax = typeof row[3] === 'number' ? row[3] : null;
    const bpRp = typeof row[4] === 'number' ? row[4] : null;

    if (ra !== null && dec !== null && magnitude !== null) {
      stars.push({
        ra,
        dec,
        magnitude,
        parallax,
        bpRp,
      });
    }
  }

  return stars;
}

/**
 * Calculate distance in light years from median parallax
 * Distance (parsecs) = 1000 / parallax (mas)
 * Distance (ly) = distance (pc) * 3.26156
 */
function calculateDistanceFromParallax(stars: GaiaStar[]): number | null {
  // Filter to stars with valid parallax
  const validParallaxes = stars
    .filter(s => s.parallax !== null && s.parallax > 0.1) // > 0.1 mas for reasonable accuracy
    .map(s => s.parallax as number);

  if (validParallaxes.length === 0) {
    return null;
  }

  // Use median parallax for robustness
  validParallaxes.sort((a, b) => a - b);
  const medianIndex = Math.floor(validParallaxes.length / 2);
  const medianParallax = validParallaxes[medianIndex];

  // Convert to light years
  const distancePc = 1000 / medianParallax;
  const distanceLy = distancePc * 3.26156;

  return Math.round(distanceLy);
}

/**
 * Format distance for display
 */
export function formatDistance(distanceLy: number | null): string {
  if (distanceLy === null) {
    return 'Unknown';
  }

  if (distanceLy >= 1000000) {
    return `${(distanceLy / 1000000).toFixed(1)} million ly`;
  }
  if (distanceLy >= 1000) {
    return `${(distanceLy / 1000).toFixed(1)}k ly`;
  }
  return `${distanceLy.toLocaleString()} ly`;
}
