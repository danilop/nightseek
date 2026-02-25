import type { BortleScore } from '@/types';

/**
 * Bortle Scale descriptions and corresponding naked eye limiting magnitudes
 */
const BORTLE_DATA: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, Omit<BortleScore, 'value'>> = {
  1: {
    label: 'Excellent Dark Site',
    nakedEyeLimitingMag: 7.6,
    description:
      'Zodiacal light, gegenschein, and zodiacal band visible. M33 visible with direct vision. Scorpius and Sagittarius extremely rich.',
  },
  2: {
    label: 'Typical Dark Site',
    nakedEyeLimitingMag: 7.1,
    description:
      'Airglow weakly visible near horizon. M33 easily visible with direct vision. Summer Milky Way highly structured.',
  },
  3: {
    label: 'Rural Sky',
    nakedEyeLimitingMag: 6.6,
    description:
      'Some light pollution evident at the horizon. Clouds illuminated near horizon. M15, M4, M5, M22 visible with naked eye.',
  },
  4: {
    label: 'Rural/Suburban Transition',
    nakedEyeLimitingMag: 6.2,
    description:
      'Light pollution domes visible in several directions. Milky Way still impressive overhead but lacks detail at horizon.',
  },
  5: {
    label: 'Suburban Sky',
    nakedEyeLimitingMag: 5.6,
    description:
      'Milky Way very weak or invisible near horizon. Light sources visible in most directions. Clouds noticeably brighter than sky.',
  },
  6: {
    label: 'Bright Suburban Sky',
    nakedEyeLimitingMag: 5.1,
    description:
      'Milky Way only visible near zenith. Sky within 35° of horizon glows grayish white. Clouds appear fairly bright.',
  },
  7: {
    label: 'Suburban/Urban Transition',
    nakedEyeLimitingMag: 4.6,
    description:
      'Entire sky has grayish-white hue. Strong light sources visible in all directions. Milky Way invisible.',
  },
  8: {
    label: 'City Sky',
    nakedEyeLimitingMag: 4.1,
    description:
      'Sky glows whitish gray or orange. You can read headlines without difficulty. M31 and M44 barely glimpsed by experienced observer.',
  },
  9: {
    label: 'Inner-City Sky',
    nakedEyeLimitingMag: 3.5,
    description:
      'Entire sky is brightly lit. Many stars making up constellation patterns invisible. Only the Moon, planets, and a few bright stars visible.',
  },
};

// ─── Grid-based lookup ───────────────────────────────────────────────────────

interface LightPollutionGrid {
  version: number;
  resolution: number;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
  latSteps: number;
  lonSteps: number;
  grid: string; // base64-encoded Uint8Array
}

let gridData: Uint8Array | null = null;
let gridMeta: LightPollutionGrid | null = null;

/* v8 ignore start */
/**
 * Lazily load and decode the light pollution grid.
 * The grid is ~250KB compressed and loaded once into memory.
 */
async function loadGrid(): Promise<{ data: Uint8Array; meta: LightPollutionGrid } | null> {
  if (gridData && gridMeta) return { data: gridData, meta: gridMeta };

  try {
    const module = await import('@/data/light-pollution.json');
    const json = module.default as LightPollutionGrid;

    // Decode base64 grid to Uint8Array
    const binaryStr = atob(json.grid);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    gridData = bytes;
    gridMeta = json;
    return { data: bytes, meta: json };
  } catch {
    return null;
  }
}
/* v8 ignore stop */

/**
 * Look up Bortle class from the pre-processed grid.
 * Returns null if the grid is not available or the location is out of bounds.
 */
function lookupGrid(
  lat: number,
  lon: number,
  data: Uint8Array,
  meta: LightPollutionGrid
): BortleScore['value'] | null {
  if (lat < meta.latMin || lat >= meta.latMax) return null;
  if (lon < meta.lonMin || lon >= meta.lonMax) return null;

  const latIdx = Math.floor((lat - meta.latMin) / meta.resolution);
  const lonIdx = Math.floor((lon - meta.lonMin) / meta.resolution);

  if (latIdx < 0 || latIdx >= meta.latSteps) return null;
  if (lonIdx < 0 || lonIdx >= meta.lonSteps) return null;

  const value = data[latIdx * meta.lonSteps + lonIdx];
  if (value < 1 || value > 9) return null;

  return value as BortleScore['value'];
}

// ─── Synchronous grid cache for immediate lookups ────────────────────────────

let syncGridLoaded = false;
let syncGridPromise: Promise<void> | null = null;

/* v8 ignore start */
/**
 * Kick off grid loading. Called early in app lifecycle.
 */
export function preloadLightPollutionGrid(): void {
  if (syncGridPromise) return;
  syncGridPromise = loadGrid()
    .then(() => {
      syncGridLoaded = true;
    })
    .catch(() => {
      // Grid load failed - will use latitude-based fallback
    });
}
/* v8 ignore stop */

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Calculate Bortle score from latitude/longitude.
 *
 * Uses a pre-processed 0.5-degree resolution grid derived from population
 * density data and known dark sky sites. Falls back to latitude-based
 * heuristics if the grid is not yet loaded.
 */
export function calculateBortle(lat: number, lon: number): BortleScore {
  // Try grid lookup first (available after preload completes)
  if (syncGridLoaded && gridData && gridMeta) {
    const gridValue = lookupGrid(lat, lon, gridData, gridMeta);
    if (gridValue !== null) {
      return { value: gridValue, ...BORTLE_DATA[gridValue] };
    }
  }

  // Fallback: latitude-based heuristic (same as before grid was available)
  return fallbackBortle(lat, lon);
}

/**
 * Latitude/longitude heuristic fallback when grid is unavailable.
 */
function fallbackBortle(lat: number, lon: number): BortleScore {
  const absLat = Math.abs(lat);

  // Very high latitudes (Arctic/Antarctic) - typically dark
  if (absLat > 70) {
    const value = 2 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Remote ocean locations
  if (lat > -30 && lat < 30 && lon > -170 && lon < -100) {
    const value = 1 as const;
    return { value, ...BORTLE_DATA[value] };
  }
  if (lat > -30 && lat < 30 && lon > -50 && lon < -10) {
    const value = 1 as const;
    return { value, ...BORTLE_DATA[value] };
  }
  if (lat > -30 && lat < 10 && lon > 60 && lon < 90) {
    const value = 1 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Tropical regions outside cities
  if (absLat < 25) {
    const value = 4 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Temperate mid-latitudes (most populated)
  if (absLat >= 25 && absLat <= 55) {
    const value = 5 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Higher latitudes (less populated)
  if (absLat > 55 && absLat <= 70) {
    const value = 3 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Default fallback - suburban
  const value = 5 as const;
  return { value, ...BORTLE_DATA[value] };
}

/**
 * Get color class for Bortle value
 */
export function getBortleColorClass(bortle: BortleScore['value']): string {
  if (bortle <= 3) return 'text-green-400';
  if (bortle <= 5) return 'text-yellow-400';
  if (bortle <= 7) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Get background color class for Bortle badge
 */
export function getBortleBgClass(bortle: BortleScore['value']): string {
  if (bortle <= 3) return 'bg-green-500/20';
  if (bortle <= 5) return 'bg-yellow-500/20';
  if (bortle <= 7) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}
