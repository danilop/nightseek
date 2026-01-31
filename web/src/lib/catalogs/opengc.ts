import type { DSOCatalogEntry, DSOSubtype } from '@/types';
import { getCached, setCache } from '../utils/cache';
import { getCommonName, MESSIER_EXTRAS } from './common-names';

const OPENGC_URL =
  'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv';
const CACHE_KEY = 'nightseek:opengc';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Map OpenNGC type codes to DSOSubtype
 */
function mapTypeToSubtype(type: string): DSOSubtype {
  const mapping: Record<string, DSOSubtype> = {
    G: 'galaxy',
    GGroup: 'galaxy_group',
    GPair: 'galaxy_pair',
    GTrpl: 'galaxy_triplet',
    PN: 'planetary_nebula',
    HII: 'hii_region',
    EmN: 'emission_nebula',
    RfN: 'reflection_nebula',
    SNR: 'supernova_remnant',
    OCl: 'open_cluster',
    GCl: 'globular_cluster',
    Ast: 'asterism',
    DN: 'dark_nebula',
    'Cl+N': 'open_cluster', // Cluster with nebulosity
    Neb: 'nebula',
  };

  return mapping[type] || 'other';
}

/**
 * Parse RA from HH:MM:SS.s format to hours
 */
function parseRA(ra: string): number | null {
  if (!ra || ra.trim() === '') return null;

  const match = ra.match(/(\d+):(\d+):(\d+\.?\d*)/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseFloat(match[3]);

  return hours + minutes / 60 + seconds / 3600;
}

/**
 * Parse Dec from +/-DD:MM:SS.s format to degrees
 */
function parseDec(dec: string): number | null {
  if (!dec || dec.trim() === '') return null;

  const match = dec.match(/([+-]?)(\d+):(\d+):(\d+\.?\d*)/);
  if (!match) return null;

  const sign = match[1] === '-' ? -1 : 1;
  const degrees = parseInt(match[2], 10);
  const minutes = parseInt(match[3], 10);
  const seconds = parseFloat(match[4]);

  return sign * (degrees + minutes / 60 + seconds / 3600);
}

/**
 * Parse a single line from the OpenNGC CSV
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

/**
 * Load and parse the OpenNGC catalog
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: CSV parsing requires handling multiple field types and validation
export async function loadOpenNGCCatalog(
  options: { maxMagnitude?: number; observerLatitude?: number; minAltitude?: number } = {}
): Promise<DSOCatalogEntry[]> {
  const { maxMagnitude = 14.0, observerLatitude, minAltitude = 30 } = options;

  // Check cache first
  const cached = await getCached<DSOCatalogEntry[]>(CACHE_KEY, CACHE_TTL);
  if (cached) {
    return filterCatalog(cached, maxMagnitude, observerLatitude, minAltitude);
  }

  // Fetch from URL
  const response = await fetch(OPENGC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenNGC catalog: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split('\n');

  // Parse header to find column indices
  const header = parseCSVLine(lines[0]);
  const cols: Record<string, number> = {};
  header.forEach((col, i) => {
    cols[col] = i;
  });

  const catalog: DSOCatalogEntry[] = [];

  // Skip types that aren't DSOs
  const skipTypes = new Set(['NonEx', 'Dup', '*', '**', '*Ass']);

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    const name = fields[cols.Name] || '';
    const type = fields[cols.Type] || '';
    const raStr = fields[cols.RA] || '';
    const decStr = fields[cols.Dec] || '';
    const vMag = fields[cols['V-Mag']] || '';
    const bMag = fields[cols['B-Mag']] || '';
    const majorAx = fields[cols.MajAx] || '';
    const minorAx = fields[cols.MinAx] || '';
    const constellation = fields[cols.Const] || '';
    const messier = fields[cols.M] || '';

    // Skip non-DSO types
    if (skipTypes.has(type)) continue;

    // Parse coordinates
    const raHours = parseRA(raStr);
    const decDegrees = parseDec(decStr);
    if (raHours === null || decDegrees === null) continue;

    // Parse magnitude (prefer V-Mag, fall back to B-Mag)
    let magnitude: number | null = null;
    if (vMag && !Number.isNaN(parseFloat(vMag))) {
      magnitude = parseFloat(vMag);
    } else if (bMag && !Number.isNaN(parseFloat(bMag))) {
      magnitude = parseFloat(bMag);
    }

    // Parse angular size
    const majorAxisArcmin =
      majorAx && !Number.isNaN(parseFloat(majorAx)) ? parseFloat(majorAx) : null;
    const minorAxisArcmin =
      minorAx && !Number.isNaN(parseFloat(minorAx)) ? parseFloat(minorAx) : null;

    // Get Messier number
    const messierNumber = messier?.match(/\d+/) ? parseInt(messier, 10) : null;

    // Get common name
    const commonName = getCommonName(name);

    // Calculate surface brightness if possible
    let surfaceBrightness: number | null = null;
    if (magnitude !== null && majorAxisArcmin !== null && majorAxisArcmin > 0) {
      const minorAx = minorAxisArcmin || majorAxisArcmin;
      const areaArcsec2 = Math.PI * ((majorAxisArcmin * 60) / 2) * ((minorAx * 60) / 2);
      surfaceBrightness = magnitude + 2.5 * Math.log10(areaArcsec2);
    }

    catalog.push({
      name,
      type: mapTypeToSubtype(type),
      raHours,
      decDegrees,
      magnitude,
      majorAxisArcmin,
      minorAxisArcmin,
      constellation,
      messierNumber,
      commonName,
      surfaceBrightness,
    });
  }

  // Add Messier objects not in NGC/IC
  for (const extra of MESSIER_EXTRAS) {
    catalog.push({
      name: extra.name,
      type: extra.type === 'OCl' ? 'open_cluster' : 'double_star',
      raHours: extra.raHours,
      decDegrees: extra.decDegrees,
      magnitude: extra.magnitude,
      majorAxisArcmin: extra.sizeArcmin,
      minorAxisArcmin: extra.sizeArcmin,
      constellation: '',
      messierNumber: parseInt(extra.name.replace('M', ''), 10),
      commonName: extra.commonName,
      surfaceBrightness: null,
    });
  }

  // Cache the full catalog
  await setCache(CACHE_KEY, catalog);

  return filterCatalog(catalog, maxMagnitude, observerLatitude, minAltitude);
}

/**
 * Filter catalog based on magnitude and visibility from observer location
 */
function filterCatalog(
  catalog: DSOCatalogEntry[],
  maxMagnitude: number,
  observerLatitude?: number,
  minAltitude: number = 30
): DSOCatalogEntry[] {
  return catalog.filter(entry => {
    // Magnitude filter (allow null to pass for very extended objects)
    if (entry.magnitude !== null && entry.magnitude > maxMagnitude) {
      return false;
    }

    // Declination filter based on observer latitude
    if (observerLatitude !== undefined) {
      // Object must be able to reach minAltitude from observer location
      // Max altitude = 90 - |latitude - declination|
      const maxPossibleAlt = 90 - Math.abs(observerLatitude - entry.decDegrees);
      if (maxPossibleAlt < minAltitude) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Search for objects by name or common name
 */
export function searchCatalog(catalog: DSOCatalogEntry[], query: string): DSOCatalogEntry[] {
  const lowerQuery = query.toLowerCase();

  return catalog.filter(entry => {
    if (entry.name.toLowerCase().includes(lowerQuery)) return true;
    if (entry.commonName?.toLowerCase().includes(lowerQuery)) return true;
    if (entry.messierNumber && `m${entry.messierNumber}`.includes(lowerQuery)) return true;
    return false;
  });
}
