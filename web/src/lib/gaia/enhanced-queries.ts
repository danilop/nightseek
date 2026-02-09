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
 * Build ADQL query for variable stars in a region.
 * JOINs classification (I/358/vclassre), photometry (I/355/gaiadr3),
 * and all 7 type-specific variability tables to get period + amplitude.
 *
 * Column layout (indices 0–19):
 *  0 source_id, 1 ra, 2 dec, 3 var_type, 4 type_score, 5 magnitude,
 *  6 rrl_period, 7 rrl_amp, 8 cep_period, 9 cep_amp,
 * 10 lpv_freq, 11 lpv_amp, 12 eb_freq, 13 eb_depth,
 * 14 rm_period, 15 rm_amp, 16 mso_freq, 17 mso_amp,
 * 18 st_freq, 19 st_amp
 */
function buildVariableStarsQuery(raDeg: number, decDeg: number, radiusDeg: number): string {
  // No table aliases — VizieR rejects alias.column with quoted table names.
  const vc = '"I/358/vclassre"';
  const gd = '"I/355/gaiadr3"';
  const rrl = '"I/358/vrrlyr"';
  const cep = '"I/358/vcep"';
  const lpv = '"I/358/vlpv"';
  const eb = '"I/358/veb"';
  const rm = '"I/358/vrm"';
  const mso = '"I/358/vmsosc"';
  const st = '"I/358/vst"';

  return `
    SELECT TOP ${MAX_VARIABLES}
      ${vc}."Source" as source_id,
      ${vc}.RA_ICRS as ra,
      ${vc}.DE_ICRS as dec,
      ${vc}."Class" as var_type,
      ${vc}.ClassSc as type_score,
      ${gd}.Gmag as magnitude,
      ${rrl}.PF as rrl_period,
      ${rrl}.ptpG as rrl_amp,
      ${cep}.PF as cep_period,
      ${cep}.ptpG as cep_amp,
      ${lpv}.Freq as lpv_freq,
      ${lpv}.Amp as lpv_amp,
      ${eb}.Freq as eb_freq,
      ${eb}.DepthE1 as eb_depth,
      ${rm}.Prot as rm_period,
      ${rm}.AIGmax as rm_amp,
      ${mso}.Freq1 as mso_freq,
      ${mso}.AmpGFreq1 as mso_amp,
      ${st}.Freq as st_freq,
      ${st}.Ampl as st_amp
    FROM ${vc}
    JOIN ${gd} ON ${vc}."Source" = ${gd}."Source"
    LEFT JOIN ${rrl} ON ${vc}."Source" = ${rrl}."Source"
    LEFT JOIN ${cep} ON ${vc}."Source" = ${cep}."Source"
    LEFT JOIN ${lpv} ON ${vc}."Source" = ${lpv}."Source"
    LEFT JOIN ${eb} ON ${vc}."Source" = ${eb}."Source"
    LEFT JOIN ${rm} ON ${vc}."Source" = ${rm}."Source"
    LEFT JOIN ${mso} ON ${vc}."Source" = ${mso}."Source"
    LEFT JOIN ${st} ON ${vc}."Source" = ${st}."Source"
    WHERE 1=CONTAINS(
      POINT('ICRS', ${vc}.RA_ICRS, ${vc}.DE_ICRS),
      CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg})
    )
    ORDER BY ${vc}.ClassSc DESC
  `.trim();
}

/**
 * Build ADQL query for extragalactic candidates in a region.
 * JOINs classification (I/355/paramp), photometry (I/355/gaiadr3),
 * and redshift tables (I/356/qsocand, I/356/galcand).
 *
 * Column layout (indices 0–7):
 *  0 source_id, 1 ra, 2 dec, 3 qso_prob, 4 galaxy_prob,
 *  5 magnitude, 6 qso_redshift, 7 gal_redshift
 */
function buildGalaxyCandidatesQuery(raDeg: number, decDeg: number, radiusDeg: number): string {
  const pa = '"I/355/paramp"';
  const gd = '"I/355/gaiadr3"';
  const qc = '"I/356/qsocand"';
  const gc = '"I/356/galcand"';

  return `
    SELECT TOP ${MAX_EXTRAGALACTIC}
      ${pa}."Source" as source_id,
      ${pa}.RA_ICRS as ra,
      ${pa}.DE_ICRS as dec,
      ${pa}.PQSO as qso_prob,
      ${pa}.PGal as galaxy_prob,
      ${gd}.Gmag as magnitude,
      ${qc}.z as qso_redshift,
      ${gc}.z as gal_redshift
    FROM ${pa}
    JOIN ${gd} ON ${pa}."Source" = ${gd}."Source"
    LEFT JOIN ${qc} ON ${pa}."Source" = ${qc}."Source"
    LEFT JOIN ${gc} ON ${pa}."Source" = ${gc}."Source"
    WHERE 1=CONTAINS(
      POINT('ICRS', ${pa}.RA_ICRS, ${pa}.DE_ICRS),
      CIRCLE('ICRS', ${raDeg}, ${decDeg}, ${radiusDeg})
    )
    AND (${pa}.PGal > 0.5 OR ${pa}.PQSO > 0.5)
    ORDER BY ${pa}.PGal DESC
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

/** Helper to safely read a number from a row, returning null for non-numbers */
function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Extract period (days) from whichever type-specific table matched.
 * Some tables store frequency (d⁻¹) instead of period — convert via 1/freq.
 * Row indices 6–19, see buildVariableStarsQuery column layout.
 */
function extractPeriod(row: unknown[]): number | null {
  // RR Lyrae / Cepheid: direct period in days (indices 6, 8)
  const rrlPeriod = num(row[6]);
  if (rrlPeriod && rrlPeriod > 0) return rrlPeriod;
  const cepPeriod = num(row[8]);
  if (cepPeriod && cepPeriod > 0) return cepPeriod;
  // Rotational modulation: direct period (index 14)
  const rmPeriod = num(row[14]);
  if (rmPeriod && rmPeriod > 0) return rmPeriod;
  // LPV, EB, MSO, ST: frequency → 1/freq (indices 10, 12, 16, 18)
  for (const idx of [10, 12, 16, 18]) {
    const freq = num(row[idx]);
    if (freq && freq > 0) return 1 / freq;
  }
  return null;
}

/**
 * Extract amplitude (mag) from whichever type-specific table matched.
 * Row indices 7, 9, 11, 13, 15, 17, 19 — see buildVariableStarsQuery.
 */
function extractAmplitude(row: unknown[]): number | null {
  for (const idx of [7, 9, 11, 13, 15, 17, 19]) {
    const amp = num(row[idx]);
    if (amp && amp > 0) return amp;
  }
  return null;
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
      signal: AbortSignal.timeout(60000),
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
    // Columns: see buildVariableStarsQuery layout (indices 0–19)
    if (!Array.isArray(row) || row.length < 6) continue;

    const sourceId = row[0]?.toString() ?? '';
    const ra = num(row[1]);
    const dec = num(row[2]);
    const varType = typeof row[3] === 'string' ? row[3] : null;
    const magnitude = num(row[5]) ?? 0;
    const period = extractPeriod(row);
    const amplitude = extractAmplitude(row);

    if (ra !== null && dec !== null) {
      variables.push({
        sourceId,
        ra,
        dec,
        magnitude,
        variabilityType: mapVariabilityType(varType),
        period,
        amplitude,
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
    // Columns: see buildGalaxyCandidatesQuery layout (indices 0–7)
    if (!Array.isArray(row) || row.length < 6) continue;

    const sourceId = row[0]?.toString() ?? '';
    const ra = num(row[1]);
    const dec = num(row[2]);
    const qsoProb = num(row[3]) ?? 0;
    const galaxyProb = num(row[4]) ?? 0;
    const magnitude = num(row[5]) ?? 0;
    const qsoRedshift = num(row[6]);
    const galRedshift = num(row[7]);

    if (ra !== null && dec !== null) {
      const isQso = qsoProb > galaxyProb;
      objects.push({
        sourceId,
        ra,
        dec,
        magnitude,
        type: isQso ? 'qso' : 'galaxy',
        probability: isQso ? qsoProb : galaxyProb,
        redshift: isQso ? qsoRedshift : galRedshift,
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

  // Check cache — reuse if the cached search radius covers the requested area
  const cached = await getCached<EnhancedGaiaStarField & { _searchRadius?: number }>(
    cacheKey,
    CACHE_TTLS.GAIA_ENHANCED
  );
  if (cached && (cached._searchRadius ?? 0) >= radiusDeg) {
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

  // Cache the result with the search radius for future coverage checks
  await setCache(cacheKey, { ...enhancedField, _searchRadius: radiusDeg });

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
