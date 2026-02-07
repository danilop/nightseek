/**
 * Gaia DR3 Enhanced Queries
 * https://gea.esac.esa.int/archive/
 *
 * Additional queries for variable stars, galaxies, and QSOs
 * Uses VizieR TAP service (same as api.ts) for CORS support
 */

import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '@/lib/utils/cache';
import type { EnhancedGaiaStarField, GaiaExtragalactic, GaiaVariableStar } from '@/types';
import { fetchGaiaStarField } from './api';

// VizieR TAP service (CORS enabled)
const GAIA_TAP_URL = 'https://tapvizier.cds.unistra.fr/TAPVizieR/tap/sync';

// Max results per category
const MAX_VARIABLES = 100;
const MAX_EXTRAGALACTIC = 50;

/**
 * Build ADQL query for variable stars in a region
 * Uses Gaia DR3 variable star catalog (I/358/vclassre)
 */
function buildVariableStarsQuery(raDeg: number, decDeg: number, radiusDeg: number): string {
  // VizieR I/358/vclassre has classification only (Class, ClassSc) — no magnitude.
  // JOIN with main Gaia DR3 catalog (I/355/gaiadr3) on Source to get Gmag.
  // No table aliases — VizieR rejects alias.column with quoted table names.
  return `
    SELECT TOP ${MAX_VARIABLES}
      "I/358/vclassre"."Source" as source_id,
      "I/358/vclassre".RA_ICRS as ra,
      "I/358/vclassre".DE_ICRS as dec,
      "I/358/vclassre"."Class" as var_type,
      "I/358/vclassre".ClassSc as type_score,
      "I/355/gaiadr3".Gmag as magnitude
    FROM "I/358/vclassre"
    JOIN "I/355/gaiadr3" ON "I/358/vclassre"."Source" = "I/355/gaiadr3"."Source"
    WHERE 1=CONTAINS(
      POINT('ICRS', "I/358/vclassre".RA_ICRS, "I/358/vclassre".DE_ICRS),
      CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg})
    )
    ORDER BY "I/358/vclassre".ClassSc DESC
  `.trim();
}

/**
 * Build ADQL query for galaxy candidates in a region
 * Uses Gaia DR3 extragalactic candidates (I/355/qsocand for QSOs, using galaxy flag)
 */
function buildGalaxyCandidatesQuery(raDeg: number, decDeg: number, radiusDeg: number): string {
  // VizieR I/355/paramp has classification probabilities only — no magnitude.
  // JOIN with main Gaia DR3 catalog (I/355/gaiadr3) on Source to get Gmag.
  return `
    SELECT TOP ${MAX_EXTRAGALACTIC}
      "I/355/paramp"."Source" as source_id,
      "I/355/paramp".RA_ICRS as ra,
      "I/355/paramp".DE_ICRS as dec,
      "I/355/paramp".PQSO as qso_prob,
      "I/355/paramp".PGal as galaxy_prob,
      "I/355/gaiadr3".Gmag as magnitude
    FROM "I/355/paramp"
    JOIN "I/355/gaiadr3" ON "I/355/paramp"."Source" = "I/355/gaiadr3"."Source"
    WHERE 1=CONTAINS(
      POINT('ICRS', "I/355/paramp".RA_ICRS, "I/355/paramp".DE_ICRS),
      CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg})
    )
    AND ("I/355/paramp".PGal > 0.5 OR "I/355/paramp".PQSO > 0.5)
    ORDER BY "I/355/paramp".PGal DESC
  `.trim();
}

/**
 * Map Gaia variable type codes to our enum
 */
function mapVariabilityType(
  varType: string | null
): 'RR_LYR' | 'CEPH' | 'ECL' | 'MIRA' | 'DSCT' | 'OTHER' {
  if (!varType) return 'OTHER';

  const upperType = varType.toUpperCase();

  if (upperType.includes('RR') || upperType.includes('RRLYR')) return 'RR_LYR';
  if (upperType.includes('CEPH') || upperType.includes('CEP')) return 'CEPH';
  if (upperType.includes('ECL') || upperType.includes('EB')) return 'ECL';
  if (upperType.includes('MIRA') || upperType.includes('LPV')) return 'MIRA';
  if (upperType.includes('DSCT') || upperType.includes('SXPHE')) return 'DSCT';

  return 'OTHER';
}

/**
 * Execute a TAP query and return results
 */
async function executeTapQuery(query: string): Promise<unknown[][] | null> {
  try {
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
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;

    if (Array.isArray(data.data)) {
      return data.data as unknown[][];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch variable stars in a region
 */
async function fetchVariableStars(
  raDeg: number,
  decDeg: number,
  radiusDeg: number
): Promise<GaiaVariableStar[]> {
  const query = buildVariableStarsQuery(raDeg, decDeg, radiusDeg);
  const rows = await executeTapQuery(query);

  if (!rows) {
    return [];
  }

  const variables: GaiaVariableStar[] = [];

  for (const row of rows) {
    // Columns: source_id, ra, dec, var_type, type_score, magnitude
    if (!Array.isArray(row) || row.length < 4) continue;

    const sourceId = row[0]?.toString() ?? '';
    const ra = typeof row[1] === 'number' ? row[1] : null;
    const dec = typeof row[2] === 'number' ? row[2] : null;
    const varType = typeof row[3] === 'string' ? row[3] : null;
    const magnitude = typeof row[5] === 'number' ? row[5] : 0;

    if (ra !== null && dec !== null) {
      variables.push({
        sourceId,
        ra,
        dec,
        magnitude,
        variabilityType: mapVariabilityType(varType),
        period: null,
        amplitude: null,
        isNearMaximum: false,
      });
    }
  }

  return variables;
}

/**
 * Fetch extragalactic objects (galaxies and QSOs) in a region
 */
async function fetchExtragalacticObjects(
  raDeg: number,
  decDeg: number,
  radiusDeg: number
): Promise<GaiaExtragalactic[]> {
  const query = buildGalaxyCandidatesQuery(raDeg, decDeg, radiusDeg);
  const rows = await executeTapQuery(query);

  if (!rows) {
    return [];
  }

  const objects: GaiaExtragalactic[] = [];

  for (const row of rows) {
    // Columns: source_id, ra, dec, qso_prob, galaxy_prob, magnitude
    if (!Array.isArray(row) || row.length < 4) continue;

    const sourceId = row[0]?.toString() ?? '';
    const ra = typeof row[1] === 'number' ? row[1] : null;
    const dec = typeof row[2] === 'number' ? row[2] : null;
    const qsoProb = typeof row[3] === 'number' ? row[3] : 0;
    const galaxyProb = typeof row[4] === 'number' ? row[4] : 0;
    const magnitude = typeof row[5] === 'number' ? row[5] : 0;

    if (ra !== null && dec !== null) {
      const isQso = qsoProb > galaxyProb;
      objects.push({
        sourceId,
        ra,
        dec,
        magnitude,
        type: isQso ? 'qso' : 'galaxy',
        probability: isQso ? qsoProb : galaxyProb,
        redshift: null,
      });
    }
  }

  return objects;
}

/**
 * Fetch enhanced star field with variable stars and extragalactic objects
 */
export async function fetchEnhancedGaiaStarField(
  raHours: number,
  decDeg: number,
  radiusDeg: number = 0.5,
  objectName?: string
): Promise<EnhancedGaiaStarField | null> {
  // Check cache first
  const cacheKey = objectName
    ? `${CACHE_KEYS.GAIA_ENHANCED_PREFIX}${objectName.toLowerCase().replace(/\s+/g, '_')}`
    : `${CACHE_KEYS.GAIA_ENHANCED_PREFIX}${raHours.toFixed(4)}_${decDeg.toFixed(4)}`;

  const cached = await getCached<EnhancedGaiaStarField>(cacheKey, CACHE_TTLS.GAIA_ENHANCED);
  if (cached) {
    return {
      ...cached,
      fetchedAt: new Date(cached.fetchedAt),
    };
  }

  // Get base star field
  const baseStarField = await fetchGaiaStarField(raHours, decDeg, radiusDeg, objectName);

  if (!baseStarField) {
    return null;
  }

  // Convert RA to degrees for additional queries
  const raDeg = raHours * 15;

  // Fetch enhanced data in parallel
  const [variableStars, extragalacticObjects] = await Promise.all([
    fetchVariableStars(raDeg, decDeg, radiusDeg),
    fetchExtragalacticObjects(raDeg, decDeg, radiusDeg),
  ]);

  const enhancedField: EnhancedGaiaStarField = {
    ...baseStarField,
    variableStars,
    extragalacticObjects,
  };

  // Cache the result
  await setCache(cacheKey, enhancedField);

  return enhancedField;
}

/**
 * Get display info for a variable star type
 */
export function getVariableTypeInfo(type: GaiaVariableStar['variabilityType']): {
  label: string;
  description: string;
  color: string;
} {
  const info = {
    RR_LYR: {
      label: 'RR Lyrae',
      description: 'Pulsating horizontal branch star, used as distance indicator',
      color: '#fbbf24', // amber-400
    },
    CEPH: {
      label: 'Cepheid',
      description: 'Classical pulsating supergiant, key distance indicator',
      color: '#f59e0b', // amber-500
    },
    ECL: {
      label: 'Eclipsing Binary',
      description: 'Binary star system where components eclipse each other',
      color: '#60a5fa', // blue-400
    },
    MIRA: {
      label: 'Mira Variable',
      description: 'Long-period red giant with large brightness variations',
      color: '#f87171', // red-400
    },
    DSCT: {
      label: 'Delta Scuti',
      description: 'Short-period pulsating star on the main sequence',
      color: '#a78bfa', // violet-400
    },
    OTHER: {
      label: 'Variable',
      description: 'Other type of variable star',
      color: '#9ca3af', // gray-400
    },
  };

  return info[type];
}

/**
 * Get display info for extragalactic object type
 */
export function getExtragalacticTypeInfo(type: 'galaxy' | 'qso'): {
  label: string;
  description: string;
  color: string;
  icon: string;
} {
  if (type === 'qso') {
    return {
      label: 'Quasar',
      description: 'Quasi-stellar object - extremely luminous active galactic nucleus',
      color: '#22d3ee', // cyan-400
      icon: '◆',
    };
  }

  return {
    label: 'Galaxy',
    description: 'Background galaxy detected in the field',
    color: '#c084fc', // purple-400
    icon: '🌀',
  };
}
