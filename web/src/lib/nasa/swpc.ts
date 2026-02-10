/**
 * NOAA Space Weather Prediction Center (SWPC) — Real-time space weather data.
 * https://services.swpc.noaa.gov/json/
 *
 * All endpoints are public US government data — no API key required.
 * Data is fetched client-side and cached aggressively in IndexedDB
 * to scale across many concurrent users without overloading SWPC servers.
 */

import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '../utils/cache';
import { logger } from '../utils/logger';

const SWPC_BASE = 'https://services.swpc.noaa.gov/json';
const FETCH_TIMEOUT_MS = 10_000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KpIndexReading {
  timeTag: string; // ISO-like timestamp
  kpIndex: number;
  estimatedKp: number;
  kpSource: string;
}

export interface SolarFlareProbability {
  dateRange: string;
  cClassProbability: number;
  mClassProbability: number;
  xClassProbability: number;
}

export interface SunspotRegion {
  region: number;
  spotCount: number;
  spotClass: string;
  magClass: string;
  location: string;
  area: number;
}

export interface SolarFluxReading {
  timeTag: string;
  flux: number;
}

export interface SWPCData {
  kpIndex: KpIndexReading[];
  flareProbabilities: SolarFlareProbability[];
  sunspotRegions: SunspotRegion[];
  solarFlux: SolarFluxReading | null;
  fetchedAt: string;
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

/* v8 ignore start */
async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
/* v8 ignore stop */

// ─── Kp Index (1-minute cadence) ─────────────────────────────────────────────

interface RawKpEntry {
  time_tag: string;
  kp_index: number;
  estimated_kp: number;
  kp: number;
  source?: string;
}

export function parseKpIndex(raw: RawKpEntry[]): KpIndexReading[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(entry => entry.kp_index != null || entry.kp != null)
    .map(entry => ({
      timeTag: entry.time_tag,
      kpIndex: entry.kp_index ?? entry.kp,
      estimatedKp: entry.estimated_kp ?? entry.kp_index ?? entry.kp,
      kpSource: entry.source ?? 'SWPC',
    }));
}

/* v8 ignore start */
async function fetchKpIndex(): Promise<KpIndexReading[]> {
  const cached = await getCached<KpIndexReading[]>(CACHE_KEYS.SWPC_KP, CACHE_TTLS.SWPC_KP);
  if (cached) return cached;

  const raw = await fetchJSON<RawKpEntry[]>(`${SWPC_BASE}/planetary_k_index_1m.json`);
  if (!raw) return [];

  const parsed = parseKpIndex(raw);
  if (parsed.length > 0) {
    await setCache(CACHE_KEYS.SWPC_KP, parsed);
  }
  return parsed;
}
/* v8 ignore stop */

// ─── Solar Flare Probabilities ───────────────────────────────────────────────

interface RawFlareProbEntry {
  DateRange?: string;
  'date-range'?: string;
  C?: number;
  M?: number;
  X?: number;
  c_class?: number;
  m_class?: number;
  x_class?: number;
}

export function parseFlareProbabilities(raw: RawFlareProbEntry[]): SolarFlareProbability[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(entry => ({
    dateRange: entry.DateRange ?? entry['date-range'] ?? '',
    cClassProbability: entry.C ?? entry.c_class ?? 0,
    mClassProbability: entry.M ?? entry.m_class ?? 0,
    xClassProbability: entry.X ?? entry.x_class ?? 0,
  }));
}

/* v8 ignore start */
async function fetchFlareProbabilities(): Promise<SolarFlareProbability[]> {
  const cached = await getCached<SolarFlareProbability[]>(
    CACHE_KEYS.SWPC_FLARE_PROB,
    CACHE_TTLS.SWPC_GENERAL
  );
  if (cached) return cached;

  const raw = await fetchJSON<RawFlareProbEntry[]>(`${SWPC_BASE}/solar_probabilities.json`);
  if (!raw) return [];

  const parsed = parseFlareProbabilities(raw);
  if (parsed.length > 0) {
    await setCache(CACHE_KEYS.SWPC_FLARE_PROB, parsed);
  }
  return parsed;
}
/* v8 ignore stop */

// ─── Sunspot Report ──────────────────────────────────────────────────────────

interface RawSunspotEntry {
  Region?: number;
  region?: number;
  Numspot?: number;
  numspot?: number;
  Zurich?: string;
  zurich?: string;
  Magtype?: string;
  magtype?: string;
  Location?: string;
  location?: string;
  Area?: number;
  area?: number;
}

export function parseSunspotReport(raw: RawSunspotEntry[]): SunspotRegion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(entry => (entry.Region ?? entry.region) != null)
    .map(entry => ({
      region: entry.Region ?? entry.region ?? 0,
      spotCount: entry.Numspot ?? entry.numspot ?? 0,
      spotClass: entry.Zurich ?? entry.zurich ?? '',
      magClass: entry.Magtype ?? entry.magtype ?? '',
      location: entry.Location ?? entry.location ?? '',
      area: entry.Area ?? entry.area ?? 0,
    }));
}

/* v8 ignore start */
async function fetchSunspotReport(): Promise<SunspotRegion[]> {
  const cached = await getCached<SunspotRegion[]>(
    CACHE_KEYS.SWPC_SUNSPOTS,
    CACHE_TTLS.SWPC_GENERAL
  );
  if (cached) return cached;

  const raw = await fetchJSON<RawSunspotEntry[]>(`${SWPC_BASE}/sunspot_report.json`);
  if (!raw) return [];

  const parsed = parseSunspotReport(raw);
  if (parsed.length > 0) {
    await setCache(CACHE_KEYS.SWPC_SUNSPOTS, parsed);
  }
  return parsed;
}
/* v8 ignore stop */

// ─── Solar Radio Flux (10.7 cm / F10.7) ─────────────────────────────────────

interface RawFluxEntry {
  time_tag: string;
  flux: number;
}

/* v8 ignore start */
async function fetchSolarFlux(): Promise<SolarFluxReading | null> {
  const cached = await getCached<SolarFluxReading>(CACHE_KEYS.SWPC_FLUX, CACHE_TTLS.SWPC_GENERAL);
  if (cached) return cached;

  const raw = await fetchJSON<RawFluxEntry[]>(`${SWPC_BASE}/f107_cm_flux.json`);
  if (!raw || raw.length === 0) return null;

  // Take the most recent reading
  const latest = raw[raw.length - 1];
  const reading: SolarFluxReading = {
    timeTag: latest.time_tag,
    flux: latest.flux,
  };

  await setCache(CACHE_KEYS.SWPC_FLUX, reading);
  return reading;
}
/* v8 ignore stop */

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch all SWPC data sources in parallel.
 * Each source fails independently — partial data is returned rather than nothing.
 * Caching ensures minimal API load even with many concurrent users.
 */
/* v8 ignore start */
export async function fetchSWPCData(): Promise<SWPCData | null> {
  // Check for a combined cache hit first (saves 4 IndexedDB reads)
  const cached = await getCached<SWPCData>(CACHE_KEYS.SWPC_COMBINED, CACHE_TTLS.SWPC_KP);
  if (cached) return cached;

  try {
    const [kpIndex, flareProbabilities, sunspotRegions, solarFlux] = await Promise.all([
      fetchKpIndex(),
      fetchFlareProbabilities(),
      fetchSunspotReport(),
      fetchSolarFlux(),
    ]);

    // Return null only if we got absolutely nothing
    if (kpIndex.length === 0 && flareProbabilities.length === 0 && sunspotRegions.length === 0) {
      return null;
    }

    const data: SWPCData = {
      kpIndex,
      flareProbabilities,
      sunspotRegions,
      solarFlux,
      fetchedAt: new Date().toISOString(),
    };

    await setCache(CACHE_KEYS.SWPC_COMBINED, data);
    return data;
  } catch (e) {
    logger.warn('SWPC data fetch failed', e);
    return null;
  }
}
/* v8 ignore stop */

/**
 * Get the current (most recent) Kp index from SWPC real-time data.
 */
export function getCurrentKp(data: SWPCData): number {
  if (data.kpIndex.length === 0) return 0;
  // Last entry is most recent
  return data.kpIndex[data.kpIndex.length - 1].kpIndex;
}

/**
 * Get the maximum Kp index from the last 24 hours of SWPC data.
 */
export function getRecentMaxKp(data: SWPCData): number {
  if (data.kpIndex.length === 0) return 0;

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let max = 0;

  for (const reading of data.kpIndex) {
    const readingTime = new Date(reading.timeTag).getTime();
    if (readingTime >= cutoff && reading.kpIndex > max) {
      max = reading.kpIndex;
    }
  }

  return max || data.kpIndex[data.kpIndex.length - 1].kpIndex;
}

/**
 * Get the solar activity summary label based on F10.7 flux.
 */
export function getSolarActivityLabel(
  flux: number | null
): 'low' | 'moderate' | 'high' | 'very high' {
  if (flux === null) return 'low';
  if (flux < 100) return 'low';
  if (flux < 150) return 'moderate';
  if (flux < 200) return 'high';
  return 'very high';
}

/**
 * Get today's flare probability (first entry = today or next period).
 */
export function getTodayFlareProbability(data: SWPCData): SolarFlareProbability | null {
  return data.flareProbabilities[0] ?? null;
}
