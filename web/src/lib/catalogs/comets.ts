import cometsJson from '@/data/comets.json';
import type { NightInfo, ObjectVisibility } from '@/types';
import type { SkyCalculator } from '../astronomy/calculator';
import { GAUSSIAN_GRAVITATIONAL_CONSTANT } from '../astronomy/constants';
import {
  lightTimeCorrectedEquatorial,
  meanMotion,
  orbitalToEcliptic,
  solveKepler,
} from '../astronomy/orbital-mechanics';
import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '../utils/cache';

// MPC Comet data URL - we'll use a CORS proxy or fetch directly
const MPC_COMET_URL = 'https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt';

/**
 * Parsed comet from MPC data
 */
export interface ParsedComet {
  designation: string;
  name: string;
  perihelionDistance: number; // q in AU
  eccentricity: number;
  inclination: number; // degrees
  longitudeOfAscendingNode: number; // degrees
  argumentOfPerihelion: number; // degrees
  perihelionTime: number; // Julian date
  absoluteMagnitude: number; // g
  slopeParameter: number; // k (default 10)
  isInterstellar: boolean;
  epochJD: number;
}

/** MPC interstellar designations use a numbered I/ prefix (for example 2I/Borisov). */
export function isInterstellarDesignation(designation: string): boolean {
  return /^\d+I(?:\/|$)/i.test(designation.trim());
}

function normalizeComet(comet: ParsedComet): ParsedComet {
  return { ...comet, isInterstellar: isInterstellarDesignation(comet.designation) };
}

/**
 * Calculate apparent magnitude for a comet
 * m = g + 5*log10(Δ) + k*log10(r)
 * where:
 *   g = absolute magnitude
 *   Δ = Earth distance (AU)
 *   r = Sun distance (AU)
 *   k = slope parameter (typically 10)
 */
export function calculateCometMagnitude(
  absoluteMag: number,
  earthDistanceAU: number,
  sunDistanceAU: number,
  slopeParameter: number = 10
): number {
  if (earthDistanceAU <= 0 || sunDistanceAU <= 0) return 99.0;

  return absoluteMag + 5 * Math.log10(earthDistanceAU) + slopeParameter * Math.log10(sunDistanceAU);
}

/**
 * Parse MPC comet designation and name
 * Examples:
 *   "C/2023 A3 (Tsuchinshan-ATLAS)" -> code="C/2023 A3", name="Tsuchinshan-ATLAS"
 *   "12P/Pons-Brooks" -> code="12P", name="Pons-Brooks"
 */
function parseCometName(fullDesignation: string): { designation: string; name: string } {
  // MPC appends a publication reference in a distant fixed-width column.
  const catalogName = fullDesignation.trim().split(/\s{2,}/, 1)[0];

  // Check for name in parentheses
  if (catalogName.includes('(') && catalogName.includes(')')) {
    const parenStart = catalogName.indexOf('(');
    const parenEnd = catalogName.lastIndexOf(')');
    const code = catalogName.substring(0, parenStart).trim();
    const name = catalogName.substring(parenStart + 1, parenEnd);
    return { designation: code, name };
  }

  // Check for periodic comet format (e.g., "12P/Pons-Brooks")
  if (catalogName.includes('/')) {
    const slashIndex = catalogName.indexOf('/');
    const code = catalogName.substring(0, slashIndex);
    const name = catalogName.substring(slashIndex + 1);
    return { designation: code, name };
  }

  return { designation: catalogName, name: catalogName };
}

/**
 * Parse MPC comet elements format
 * The format is a fixed-width text file with columns:
 * Columns 1-4: Perihelion year
 * Columns 6-7: Perihelion month
 * etc.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fixed-width MPC parsing validates each independent field
export function parseMPCCometLine(line: string): ParsedComet | null {
  try {
    // Skip header lines and empty lines
    if (line.trim().length < 100 || line.startsWith('#') || line.startsWith('Num')) {
      return null;
    }

    // MPC CometEls fixed-width columns (zero-based slice boundaries below).
    // Perihelion date: columns 15-29 (YYYYMMDD.dddd)
    // q (perihelion dist): columns 31-39
    // e (eccentricity): columns 42-51
    // ω (arg of perihelion): columns 52-62
    // Ω (long of asc node): columns 62-72
    // i (inclination): columns 72-82
    // Epoch: columns 82-93
    // H (abs magnitude): columns 93-98
    // G (slope): columns 98-103
    // Designation/Name: columns 103-end

    const perihelionDateStr = line.substring(14, 29).trim();
    const qStr = line.substring(30, 40).trim();
    const eStr = line.substring(41, 52).trim();
    const omegaStr = line.substring(51, 62).trim();
    const nodeStr = line.substring(61, 72).trim();
    const incStr = line.substring(71, 82).trim();
    const epochStr = line.substring(81, 93).trim();
    const hStr = line.substring(91, 97).trim();
    const kStr = line.substring(96, 102).trim();
    const nameStr = line.substring(102).trim();

    const q = parseFloat(qStr);
    const e = parseFloat(eStr);
    const inc = parseFloat(incStr);
    const omega = parseFloat(omegaStr);
    const node = parseFloat(nodeStr);
    const parsedH = parseFloat(hStr);
    const parsedK = parseFloat(kStr);
    const H = Number.isFinite(parsedH) ? parsedH : 10.0;
    const K = Number.isFinite(parsedK) ? parsedK : 10.0;

    if (Number.isNaN(q) || Number.isNaN(e)) {
      return null;
    }

    // Parse perihelion date (YYYYMMDD.dddd format)
    const perihelionParts = perihelionDateStr.split(/\s+/);
    if (perihelionParts.length !== 3) return null;
    const year = parseInt(perihelionParts[0], 10);
    const month = parseInt(perihelionParts[1], 10);
    const day = parseFloat(perihelionParts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

    // Convert the fractional calendar day to Julian date.
    const perihelionJD = dateToJulian(year, month, day);

    // Parse epoch
    let epochJD = perihelionJD;
    if (epochStr.length >= 8) {
      const epochYear = parseInt(epochStr.substring(0, 4), 10);
      const epochMonth = parseInt(epochStr.substring(4, 6), 10);
      const epochDay = parseFloat(epochStr.substring(6));
      if (Number.isFinite(epochYear) && Number.isFinite(epochMonth) && Number.isFinite(epochDay)) {
        epochJD = dateToJulian(epochYear, epochMonth, epochDay);
      }
    }

    const { designation, name } = parseCometName(nameStr);

    return {
      designation,
      name: name || designation,
      perihelionDistance: q,
      eccentricity: e,
      inclination: Number.isNaN(inc) ? 0 : inc,
      longitudeOfAscendingNode: Number.isNaN(node) ? 0 : node,
      argumentOfPerihelion: Number.isNaN(omega) ? 0 : omega,
      perihelionTime: perihelionJD,
      absoluteMagnitude: H,
      slopeParameter: K,
      isInterstellar: isInterstellarDesignation(designation),
      epochJD,
    };
  } catch {
    return null;
  }
}

/**
 * Convert date to Julian date
 */
function dateToJulian(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

/**
 * Calculate comet position in heliocentric ecliptic coordinates
 * Returns [x, y, z] in AU
 */
export function calculateCometPosition(
  comet: ParsedComet,
  julianDate: number
): { x: number; y: number; z: number; r: number } {
  const {
    perihelionDistance: q,
    eccentricity: e,
    inclination: i,
    longitudeOfAscendingNode: Omega,
    argumentOfPerihelion: omega,
    perihelionTime: T,
  } = comet;

  // Convert angles to radians
  const iRad = (i * Math.PI) / 180;
  const OmegaRad = (Omega * Math.PI) / 180;
  const omegaRad = (omega * Math.PI) / 180;

  // Time since perihelion in days
  const dt = julianDate - T;

  // True anomaly and distance
  let nu: number;
  let r: number;

  if (e === 1) {
    // Barker's equation for the parabolic case.
    const w = (3 * GAUSSIAN_GRAVITATIONAL_CONSTANT * dt) / Math.sqrt(2 * q ** 3);
    const d = 2 * Math.sinh(Math.asinh(w / 2) / 3);
    nu = 2 * Math.atan(d);
    r = q * (1 + d * d);
  } else if (e < 1) {
    const a = q / (1 - e);
    const eccentricAnomaly = solveKepler(meanMotion(a) * dt, e, 50, 1e-10);
    nu =
      2 *
      Math.atan2(
        Math.sqrt(1 + e) * Math.sin(eccentricAnomaly / 2),
        Math.sqrt(1 - e) * Math.cos(eccentricAnomaly / 2)
      );
    r = a * (1 - e * Math.cos(eccentricAnomaly));
  } else {
    const a = q / (e - 1);
    const hyperbolicAnomaly = solveKepler(meanMotion(a) * dt, e, 50, 1e-10);
    nu =
      2 *
      Math.atan2(
        Math.sqrt(e + 1) * Math.sinh(hyperbolicAnomaly / 2),
        Math.sqrt(e - 1) * Math.cosh(hyperbolicAnomaly / 2)
      );
    r = a * (e * Math.cosh(hyperbolicAnomaly) - 1);
  }

  // Position in orbital plane
  const xOrbital = r * Math.cos(nu);
  const yOrbital = r * Math.sin(nu);

  // Transform to heliocentric ecliptic coordinates
  const ecliptic = orbitalToEcliptic(xOrbital, yOrbital, omegaRad, OmegaRad, iRad);

  return { ...ecliptic, r };
}

// heliocentricToEquatorial is re-exported from orbital-mechanics for backward compatibility
export { heliocentricToEquatorial } from '../astronomy/orbital-mechanics';

function getCometEquatorial(
  comet: ParsedComet,
  time: Date
): { raHours: number; decDegrees: number } {
  const jd = time.getTime() / 86400000 + 2440587.5;
  const equator = lightTimeCorrectedEquatorial(
    sampleJD => calculateCometPosition(comet, sampleJD),
    jd
  );
  return { raHours: equator.ra, decDegrees: equator.dec };
}

/**
 * Get comet data from bundled static JSON, with IndexedDB cache and MPC live fallback.
 */
export async function fetchComets(maxMagnitude: number = 12.0): Promise<ParsedComet[]> {
  // Check cache first
  const cached = await getCached<ParsedComet[]>(CACHE_KEYS.COMETS, CACHE_TTLS.COMETS);
  if (cached) {
    return cached.map(normalizeComet).filter(c => c.absoluteMagnitude <= maxMagnitude + 5);
  }

  // Use bundled static data
  const staticComets = cometsJson as unknown as ParsedComet[];
  if (staticComets && staticComets.length > 0) {
    await setCache(CACHE_KEYS.COMETS, staticComets);
    return staticComets.map(normalizeComet).filter(c => c.absoluteMagnitude <= maxMagnitude + 5);
  }

  // Fallback: try fetching directly from MPC
  try {
    const response = await fetch(MPC_COMET_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch comet data: ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split('\n');
    const comets: ParsedComet[] = [];

    for (const line of lines) {
      const comet = parseMPCCometLine(line);
      if (comet) {
        comets.push(comet);
      }
    }

    await setCache(CACHE_KEYS.COMETS, comets);
    return comets.filter(c => c.absoluteMagnitude <= maxMagnitude + 5);
  } catch (_error) {
    // No data is safer than silently substituting stale historical elements,
    // which can produce convincing but wrong positions and magnitudes.
    return [];
  }
}

/**
 * Calculate comet visibility for a given night
 */
export function calculateCometVisibility(
  comet: ParsedComet,
  calculator: SkyCalculator,
  nightInfo: NightInfo,
  maxMagnitude: number = 12.0
): ObjectVisibility | null {
  // Get Julian date for midnight
  const midnight = new Date(
    (nightInfo.observingWindowStart.getTime() + nightInfo.observingWindowEnd.getTime()) / 2
  );
  const jd = midnight.getTime() / 86400000 + 2440587.5;

  // Calculate comet position
  const equator = lightTimeCorrectedEquatorial(
    sampleJD => calculateCometPosition(comet, sampleJD),
    jd
  );
  const { ra, dec, distance: earthDist } = equator;
  const emittedPosition = calculateCometPosition(comet, equator.emissionJulianDate);

  // Skip if position calculation produced invalid values
  if (
    !Number.isFinite(ra) ||
    !Number.isFinite(dec) ||
    !Number.isFinite(earthDist) ||
    earthDist <= 0
  ) {
    return null;
  }

  // Calculate apparent magnitude
  const apparentMag = calculateCometMagnitude(
    comet.absoluteMagnitude,
    earthDist,
    emittedPosition.r,
    comet.slopeParameter
  );

  // Skip if too faint
  if (apparentMag > maxMagnitude) {
    return null;
  }

  // Calculate visibility using the sky calculator
  const visibility = calculator.calculateVisibility(
    ra,
    dec,
    nightInfo,
    comet.designation,
    'comet',
    {
      magnitude: apparentMag,
      isInterstellar: comet.isInterstellar,
      commonName: `${comet.name} (${comet.designation})`,
      positionAtTime: time => getCometEquatorial(comet, time),
    }
  );

  // Skip if not visible
  if (!visibility.isVisible) {
    return null;
  }

  return visibility;
}
