/**
 * JPL Small-Body Database (SBDB) API client
 * https://ssd-api.jpl.nasa.gov/doc/sbdb.html
 *
 * Fetches physical properties for asteroids and comets
 */

import type { AsteroidPhysicalData } from '@/types';
import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '../utils/cache';

// API base URL
const SBDB_BASE_URL = 'https://ssd-api.jpl.nasa.gov/sbdb.api';

interface SBDBApiResponse {
  object?: {
    fullname?: string;
    kind?: string;
    des?: string;
    prefix?: string;
  };
  phys_par?: Array<{
    name: string;
    value: string;
    sigma?: string;
    units?: string;
    ref?: string;
  }>;
}

/**
 * Normalize asteroid designation for cache key
 * Handles various formats: "1 Ceres", "(1) Ceres", "2024 AB", etc.
 */
function normalizeDesignation(designation: string): string {
  return designation
    .replace(/^\(/, '') // Remove leading parenthesis
    .replace(/\)$/, '') // Remove trailing parenthesis
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .toLowerCase();
}

/**
 * Extract physical parameter value from API response
 */
function getPhysParam(phys_par: SBDBApiResponse['phys_par'], name: string): string | null {
  if (!phys_par) return null;
  const param = phys_par.find(p => p.name === name);
  return param?.value ?? null;
}

/**
 * Parse numeric value from parameter, handling special cases
 */
function parseNumericParam(value: string | null): number | null {
  if (!value) return null;

  // Remove any uncertainty notation (e.g., "4.2 ± 0.1" -> "4.2")
  const cleanValue = value.split(/[±+-]/)[0].trim();

  const num = Number.parseFloat(cleanValue);
  return Number.isNaN(num) ? null : num;
}

/**
 * Transform API response into our domain model
 */
function transformPhysicalData(data: SBDBApiResponse): AsteroidPhysicalData | null {
  if (!data.phys_par || data.phys_par.length === 0) {
    return null;
  }

  // Extract relevant physical parameters
  // See: https://ssd-api.jpl.nasa.gov/doc/sbdb.html#phys-par
  const diameterStr = getPhysParam(data.phys_par, 'diameter');
  const albedoStr = getPhysParam(data.phys_par, 'albedo');
  const spectralType =
    getPhysParam(data.phys_par, 'spec_T') || getPhysParam(data.phys_par, 'spec_B');
  const rotationStr = getPhysParam(data.phys_par, 'rot_per');

  return {
    diameter: parseNumericParam(diameterStr),
    albedo: parseNumericParam(albedoStr),
    spectralType,
    rotationPeriod: parseNumericParam(rotationStr),
  };
}

/**
 * Fetch physical data for an asteroid or comet
 * Uses aggressive caching (30 days) since physical data rarely changes
 */
export async function fetchAsteroidPhysicalData(
  designation: string
): Promise<AsteroidPhysicalData | null> {
  const normalizedDes = normalizeDesignation(designation);
  const cacheKey = `${CACHE_KEYS.SBDB_PREFIX}${normalizedDes}`;

  // Check cache first
  const cached = await getCached<AsteroidPhysicalData>(cacheKey, CACHE_TTLS.SBDB);
  if (cached !== null) {
    return cached;
  }

  try {
    const params = new URLSearchParams({
      sstr: designation,
      'phys-par': 'true',
    });

    const response = await fetch(`${SBDB_BASE_URL}?${params}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as SBDBApiResponse;
    const physicalData = transformPhysicalData(data);

    // Cache even null results to avoid repeated failed lookups
    if (physicalData) {
      await setCache(cacheKey, physicalData);
    }

    return physicalData;
  } catch {
    return null;
  }
}

/**
 * Get spectral type description
 */
export function getSpectralTypeDescription(spectralType: string | null): string | null {
  if (!spectralType) return null;

  // Get the main type (first character, uppercase)
  const mainType = spectralType.charAt(0).toUpperCase();

  const descriptions: Record<string, string> = {
    C: 'Carbonaceous (dark, carbon-rich)',
    S: 'Silicaceous (stony, silicate-rich)',
    M: 'Metallic (iron-nickel)',
    V: 'Vestoid (basaltic, from Vesta)',
    E: 'Enstatite (high albedo)',
    P: 'Primitive (low albedo, organic-rich)',
    D: 'Dark (very low albedo)',
    A: 'Olivine-rich (asteroid 246 Asporina type)',
    B: 'B-type (blue, primitive)',
    F: 'F-type (low albedo, featureless)',
    G: 'G-type (similar to C but UV absorption)',
    K: 'K-type (intermediate S-C)',
    L: 'L-type (red, spinel-bearing)',
    O: 'O-type (olivine-dominated)',
    Q: 'Q-type (ordinary chondrite composition)',
    R: 'R-type (pyroxene-rich)',
    T: 'T-type (dark, featureless red)',
    X: 'X-type (degenerate E, M, or P)',
  };

  return descriptions[mainType] ?? `Type ${spectralType}`;
}

/**
 * Format rotation period for display
 */
export function formatRotationPeriod(hours: number | null): string | null {
  if (hours === null) return null;

  if (hours < 1) {
    return `${(hours * 60).toFixed(1)} min`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} hr`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

/**
 * Format diameter for display
 */
export function formatAsteroidDiameter(km: number | null): string | null {
  if (km === null) return null;

  if (km < 1) {
    return `${(km * 1000).toFixed(0)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${km.toFixed(0)} km`;
}
