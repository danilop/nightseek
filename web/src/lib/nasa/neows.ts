/**
 * NASA NeoWs (Near Earth Object Web Service) API client
 * https://api.nasa.gov/
 *
 * Fetches asteroid close approach data for display in astronomical events
 */

import type { NeoCloseApproach } from '@/types';
import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '../utils/cache';
import { fetchStaticData } from '../utils/static-data';

// NASA API key - DEMO_KEY works for light usage (30 requests/hour)
// For production, consider registering at https://api.nasa.gov for a free key
const NASA_API_KEY = 'DEMO_KEY';

// API base URL
const NEOWS_BASE_URL = 'https://api.nasa.gov/neo/rest/v1/feed';

// Threshold for "notable" close approaches (in lunar distances)
const NOTABLE_DISTANCE_LD = 20; // Show asteroids closer than 20 lunar distances

// Minimum estimated diameter to show (km) - filter out tiny objects
const MIN_DIAMETER_KM = 0.01; // 10 meters

interface NeoWsApiResponse {
  element_count: number;
  near_earth_objects: {
    [date: string]: NeoWsNeo[];
  };
}

interface NeoWsNeo {
  id: string;
  name: string;
  absolute_magnitude_h: number;
  is_potentially_hazardous_asteroid: boolean;
  estimated_diameter: {
    kilometers: {
      estimated_diameter_min: number;
      estimated_diameter_max: number;
    };
  };
  close_approach_data: Array<{
    close_approach_date: string;
    close_approach_date_full: string;
    relative_velocity: {
      kilometers_per_hour: string;
    };
    miss_distance: {
      lunar: string;
      kilometers: string;
    };
  }>;
}

/**
 * Format ISO date string for API request
 */
function formatDateForApi(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Clean up asteroid name (remove parentheses around designation)
 */
function cleanAsteroidName(name: string): string {
  // Remove outer parentheses like "(2024 AB)" -> "2024 AB"
  return name.replace(/^\((.+)\)$/, '$1');
}

/**
 * Fetch close approach data for a date range
 */
async function fetchFromApi(startDate: Date, endDate: Date): Promise<NeoWsApiResponse | null> {
  const params = new URLSearchParams({
    start_date: formatDateForApi(startDate),
    end_date: formatDateForApi(endDate),
    api_key: NASA_API_KEY,
  });

  try {
    const response = await fetch(`${NEOWS_BASE_URL}?${params}`);

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as NeoWsApiResponse;
  } catch {
    return null;
  }
}

/**
 * Transform API response into our domain model
 */
function transformNeoData(data: NeoWsApiResponse, targetDate: Date): NeoCloseApproach[] {
  const targetDateStr = formatDateForApi(targetDate);
  const neos = data.near_earth_objects[targetDateStr] || [];

  const approaches: NeoCloseApproach[] = [];

  for (const neo of neos) {
    // Get the close approach for the target date
    const approach = neo.close_approach_data.find(ca => ca.close_approach_date === targetDateStr);

    if (!approach) continue;

    const missDistanceLD = Number.parseFloat(approach.miss_distance.lunar);
    const diameterMin = neo.estimated_diameter.kilometers.estimated_diameter_min;
    const diameterMax = neo.estimated_diameter.kilometers.estimated_diameter_max;

    // Filter by distance and size
    if (missDistanceLD > NOTABLE_DISTANCE_LD) continue;
    if (diameterMax < MIN_DIAMETER_KM) continue;

    approaches.push({
      name: cleanAsteroidName(neo.name),
      neoId: neo.id,
      isPotentiallyHazardous: neo.is_potentially_hazardous_asteroid,
      estimatedDiameterKm: {
        min: diameterMin,
        max: diameterMax,
      },
      closeApproachDate: new Date(approach.close_approach_date_full),
      missDistanceLunarDistances: missDistanceLD,
      relativeVelocityKmh: Number.parseFloat(approach.relative_velocity.kilometers_per_hour),
      absoluteMagnitude: neo.absolute_magnitude_h,
    });
  }

  // Sort by distance (closest first)
  approaches.sort((a, b) => a.missDistanceLunarDistances - b.missDistanceLunarDistances);

  return approaches;
}

/**
 * Fetch NEO close approaches for a date range in a single API call.
 * The NeoWs API supports up to 7 days per request, so longer ranges
 * are batched into multiple calls (still far fewer than one per day).
 * Returns a Map keyed by date string (YYYY-MM-DD).
 */
interface StaticNeoFile {
  startDate: string;
  endDate: string;
  data: Record<string, NeoCloseApproach[]>;
}

/**
 * Try loading NEO data from pre-fetched static JSON.
 * Returns a populated map if the static file covers the requested date range, null otherwise.
 */
async function tryStaticNeoData(
  startDate: Date,
  days: number
): Promise<Map<string, NeoCloseApproach[]> | null> {
  try {
    const staticNeo = await fetchStaticData<StaticNeoFile>('neo.json');
    if (!staticNeo?.data) return null;

    const reqStart = formatDateForApi(startDate);
    const reqEnd = formatDateForApi(new Date(startDate.getTime() + (days - 1) * 86_400_000));
    if (reqStart < staticNeo.startDate || reqEnd > staticNeo.endDate) return null;

    const result = new Map<string, NeoCloseApproach[]>();
    for (const [dateStr, approaches] of Object.entries(staticNeo.data)) {
      result.set(
        dateStr,
        approaches.map(neo => ({ ...neo, closeApproachDate: new Date(neo.closeApproachDate) }))
      );
    }
    return result;
  } catch {
    return null;
  }
}

export async function fetchNeoCloseApproachesRange(
  startDate: Date,
  days: number
): Promise<Map<string, NeoCloseApproach[]>> {
  // Try pre-fetched static data first
  const staticResult = await tryStaticNeoData(startDate, days);
  if (staticResult) return staticResult;

  const result = new Map<string, NeoCloseApproach[]>();
  const MAX_DAYS_PER_REQUEST = 7;

  for (let offset = 0; offset < days; offset += MAX_DAYS_PER_REQUEST) {
    const batchStart = new Date(startDate);
    batchStart.setDate(batchStart.getDate() + offset);
    const batchDays = Math.min(MAX_DAYS_PER_REQUEST, days - offset);
    const batchEnd = new Date(batchStart);
    batchEnd.setDate(batchEnd.getDate() + batchDays - 1);

    const batchStartStr = formatDateForApi(batchStart);
    const cacheKey = `${CACHE_KEYS.NEOWS_PREFIX}${batchStartStr}_${batchDays}d`;

    // Check cache for this batch
    const cached = await getCached<Record<string, NeoCloseApproach[]>>(cacheKey, CACHE_TTLS.NEOWS);
    if (cached) {
      for (const [dateStr, approaches] of Object.entries(cached)) {
        result.set(
          dateStr,
          approaches.map(neo => ({ ...neo, closeApproachDate: new Date(neo.closeApproachDate) }))
        );
      }
      continue;
    }

    // Fetch from API
    const data = await fetchFromApi(batchStart, batchEnd);
    if (!data) continue;

    // Transform each day's data and collect for caching
    const batchResults: Record<string, NeoCloseApproach[]> = {};
    for (let d = 0; d < batchDays; d++) {
      const dayDate = new Date(batchStart);
      dayDate.setDate(dayDate.getDate() + d);
      const approaches = transformNeoData(data, dayDate);
      const dayStr = formatDateForApi(dayDate);
      batchResults[dayStr] = approaches;
      result.set(dayStr, approaches);
    }

    await setCache(cacheKey, batchResults);
  }

  return result;
}

/**
 * Get a human-readable description of an asteroid's distance
 */
export function getDistanceDescription(lunarDistances: number): string {
  if (lunarDistances < 1) {
    return `${(lunarDistances * 384400).toFixed(0).toLocaleString()} km (closer than Moon!)`;
  }
  if (lunarDistances < 5) {
    return `${lunarDistances.toFixed(1)} lunar distances (very close)`;
  }
  if (lunarDistances < 10) {
    return `${lunarDistances.toFixed(1)} lunar distances (close)`;
  }
  return `${lunarDistances.toFixed(1)} lunar distances`;
}

/**
 * Get a size category for display
 */
export function getSizeCategory(diameterKm: {
  min: number;
  max: number;
}): 'tiny' | 'small' | 'medium' | 'large' | 'giant' {
  const avgDiameter = (diameterKm.min + diameterKm.max) / 2;

  if (avgDiameter < 0.05) return 'tiny'; // <50m
  if (avgDiameter < 0.3) return 'small'; // 50-300m
  if (avgDiameter < 1) return 'medium'; // 300m-1km
  if (avgDiameter < 5) return 'large'; // 1-5km
  return 'giant'; // >5km
}

/**
 * Format diameter for display
 */
export function formatDiameter(diameterKm: { min: number; max: number }): string {
  const avgDiameter = (diameterKm.min + diameterKm.max) / 2;

  if (avgDiameter < 0.1) {
    // Show in meters
    const minM = Math.round(diameterKm.min * 1000);
    const maxM = Math.round(diameterKm.max * 1000);
    return `${minM}-${maxM}m`;
  }
  // Show in km
  return `${diameterKm.min.toFixed(1)}-${diameterKm.max.toFixed(1)} km`;
}
