import type { NightInfo, ObjectVisibility } from '@/types';
import type { SkyCalculator } from '../astronomy/calculator';
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
  // Check for name in parentheses
  if (fullDesignation.includes('(') && fullDesignation.includes(')')) {
    const parenStart = fullDesignation.indexOf('(');
    const parenEnd = fullDesignation.lastIndexOf(')');
    const code = fullDesignation.substring(0, parenStart).trim();
    const name = fullDesignation.substring(parenStart + 1, parenEnd);
    return { designation: code, name };
  }

  // Check for periodic comet format (e.g., "12P/Pons-Brooks")
  if (fullDesignation.includes('/')) {
    const slashIndex = fullDesignation.indexOf('/');
    const code = fullDesignation.substring(0, slashIndex);
    const name = fullDesignation.substring(slashIndex + 1);
    return { designation: code, name };
  }

  return { designation: fullDesignation, name: fullDesignation };
}

/**
 * Parse MPC comet elements format
 * The format is a fixed-width text file with columns:
 * Columns 1-4: Perihelion year
 * Columns 6-7: Perihelion month
 * etc.
 */
function parseMPCCometLine(line: string): ParsedComet | null {
  try {
    // Skip header lines and empty lines
    if (line.trim().length < 100 || line.startsWith('#') || line.startsWith('Num')) {
      return null;
    }

    // MPC comet format (approximate column positions)
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
    const H = parseFloat(hStr) || 10.0;
    const K = parseFloat(kStr) || 10.0;

    if (Number.isNaN(q) || Number.isNaN(e)) {
      return null;
    }

    // Parse perihelion date (YYYYMMDD.dddd format)
    const year = parseInt(perihelionDateStr.substring(0, 4), 10);
    const month = parseInt(perihelionDateStr.substring(4, 6), 10);
    const day = parseFloat(perihelionDateStr.substring(6));

    // Convert to Julian date (approximate)
    const perihelionJD = dateToJulian(year, month, day);

    // Parse epoch
    let epochJD = perihelionJD;
    if (epochStr.length >= 8) {
      const epochYear = parseInt(epochStr.substring(0, 4), 10);
      const epochMonth = parseInt(epochStr.substring(4, 6), 10);
      const epochDay = parseFloat(epochStr.substring(6));
      if (!Number.isNaN(epochYear)) {
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
      isInterstellar: e > 1.0,
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
 * Solve Kepler's equation for eccentric anomaly
 * M = E - e*sin(E) for elliptical orbits
 * Using Newton-Raphson iteration
 */
function solveKepler(meanAnomaly: number, eccentricity: number): number {
  const M = meanAnomaly;
  const e = eccentricity;

  if (e >= 1) {
    // Hyperbolic orbit - use different equation
    // M = e*sinh(H) - H
    let H = M;
    for (let i = 0; i < 50; i++) {
      const dH = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
      H -= dH;
      if (Math.abs(dH) < 1e-10) break;
    }
    return H;
  }

  // Elliptical orbit
  let E = M;
  for (let i = 0; i < 50; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
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

  // Semi-major axis (or use q for parabolic)
  let a: number;
  if (Math.abs(e - 1) < 0.0001) {
    // Parabolic - use perihelion distance
    a = q;
  } else if (e < 1) {
    // Elliptical
    a = q / (1 - e);
  } else {
    // Hyperbolic
    a = q / (e - 1);
  }

  // Mean motion (radians per day)
  // n = sqrt(GM_sun / a^3) where GM_sun ≈ 0.01720209895^2 AU^3/day^2
  const k = 0.01720209895; // Gaussian gravitational constant
  const n = k / Math.abs(a) ** 1.5;

  // Mean anomaly
  const M = n * dt;

  // Solve Kepler's equation
  const E = solveKepler(M, e);

  // True anomaly and distance
  let nu: number;
  let r: number;

  if (e < 1) {
    // Elliptical
    nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    r = a * (1 - e * Math.cos(E));
  } else {
    // Hyperbolic
    nu = 2 * Math.atan2(Math.sqrt(e + 1) * Math.sinh(E / 2), Math.sqrt(e - 1) * Math.cosh(E / 2));
    r = a * (e * Math.cosh(E) - 1);
  }

  // Position in orbital plane
  const xOrbital = r * Math.cos(nu);
  const yOrbital = r * Math.sin(nu);

  // Rotation matrices to ecliptic coordinates
  const cosOmega = Math.cos(OmegaRad);
  const sinOmega = Math.sin(OmegaRad);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);
  const cosOmegaArg = Math.cos(omegaRad);
  const sinOmegaArg = Math.sin(omegaRad);

  // Transform to heliocentric ecliptic coordinates
  const x =
    (cosOmega * cosOmegaArg - sinOmega * sinOmegaArg * cosI) * xOrbital +
    (-cosOmega * sinOmegaArg - sinOmega * cosOmegaArg * cosI) * yOrbital;
  const y =
    (sinOmega * cosOmegaArg + cosOmega * sinOmegaArg * cosI) * xOrbital +
    (-sinOmega * sinOmegaArg + cosOmega * cosOmegaArg * cosI) * yOrbital;
  const z = sinOmegaArg * sinI * xOrbital + cosOmegaArg * sinI * yOrbital;

  return { x, y, z, r };
}

/**
 * Get Earth's position at a given Julian date
 * Returns heliocentric ecliptic coordinates in AU
 */
function getEarthPosition(julianDate: number): { x: number; y: number; z: number } {
  // Simplified calculation using mean orbital elements
  // More accurate would use VSOP87 or astronomy-engine
  const T = (julianDate - 2451545.0) / 36525; // Julian centuries from J2000

  // Mean longitude of Earth
  const L = ((100.46646 + 36000.76983 * T) * Math.PI) / 180;

  // Earth's orbital elements (simplified)
  const a = 1.00000261; // Semi-major axis in AU
  const e = 0.01671123 - 0.00004392 * T; // Eccentricity

  // Mean anomaly
  const M = ((357.52911 + 35999.05029 * T) * Math.PI) / 180;

  // Equation of center (approximate)
  const C = (1.9146 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M);

  // True anomaly
  const nu = M + (C * Math.PI) / 180;

  // Distance
  const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));

  // Heliocentric ecliptic longitude
  const lon = L + (C * Math.PI) / 180;

  return {
    x: r * Math.cos(lon),
    y: r * Math.sin(lon),
    z: 0, // Earth is in the ecliptic plane (approximately)
  };
}

/**
 * Calculate RA/Dec from heliocentric position
 */
export function heliocentricToEquatorial(
  helioX: number,
  helioY: number,
  helioZ: number,
  julianDate: number
): { ra: number; dec: number; distance: number } {
  // Get Earth's position
  const earth = getEarthPosition(julianDate);

  // Geocentric position (relative to Earth)
  const geoX = helioX - earth.x;
  const geoY = helioY - earth.y;
  const geoZ = helioZ - earth.z;

  // Distance from Earth
  const distance = Math.sqrt(geoX * geoX + geoY * geoY + geoZ * geoZ);

  // Obliquity of the ecliptic
  const eps = (23.4393 * Math.PI) / 180;

  // Convert ecliptic to equatorial
  const eqX = geoX;
  const eqY = geoY * Math.cos(eps) - geoZ * Math.sin(eps);
  const eqZ = geoY * Math.sin(eps) + geoZ * Math.cos(eps);

  // RA and Dec
  let ra = (Math.atan2(eqY, eqX) * 180) / Math.PI;
  if (ra < 0) ra += 360;
  // Clamp to [-1, 1] to handle floating point precision issues
  const sinDec = Math.max(-1, Math.min(1, eqZ / distance));
  const dec = (Math.asin(sinDec) * 180) / Math.PI;

  return { ra: ra / 15, dec, distance }; // ra in hours
}

/**
 * Fetch and parse MPC comet data
 */
export async function fetchComets(maxMagnitude: number = 12.0): Promise<ParsedComet[]> {
  // Check cache first
  const cached = await getCached<ParsedComet[]>(CACHE_KEYS.COMETS, CACHE_TTLS.COMETS);
  if (cached) {
    return cached.filter(c => c.absoluteMagnitude <= maxMagnitude + 5); // Pre-filter
  }

  try {
    // Try fetching directly (MPC may allow CORS)
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

    // Cache the data
    await setCache(CACHE_KEYS.COMETS, comets);

    return comets.filter(c => c.absoluteMagnitude <= maxMagnitude + 5);
  } catch (_error) {
    // Return fallback bright comets
    return getFallbackComets();
  }
}

/**
 * Fallback bright comets when MPC fetch fails
 * These are approximate orbital elements for notable comets
 */
function getFallbackComets(): ParsedComet[] {
  const now = Date.now();
  const currentJD = now / 86400000 + 2440587.5;

  return [
    {
      designation: 'C/2023 A3',
      name: 'Tsuchinshan-ATLAS',
      perihelionDistance: 0.391,
      eccentricity: 1.0001,
      inclination: 139.1,
      longitudeOfAscendingNode: 21.6,
      argumentOfPerihelion: 308.5,
      perihelionTime: 2460586.5, // Oct 2024
      absoluteMagnitude: 4.5,
      slopeParameter: 10,
      isInterstellar: true,
      epochJD: currentJD,
    },
    {
      designation: '12P',
      name: 'Pons-Brooks',
      perihelionDistance: 0.781,
      eccentricity: 0.955,
      inclination: 74.2,
      longitudeOfAscendingNode: 255.9,
      argumentOfPerihelion: 199.0,
      perihelionTime: 2460412.5, // April 2024
      absoluteMagnitude: 5.0,
      slopeParameter: 10,
      isInterstellar: false,
      epochJD: currentJD,
    },
    {
      designation: '62P',
      name: 'Tsuchinshan',
      perihelionDistance: 1.378,
      eccentricity: 0.604,
      inclination: 10.3,
      longitudeOfAscendingNode: 95.8,
      argumentOfPerihelion: 16.8,
      perihelionTime: 2460650.5, // Dec 2024
      absoluteMagnitude: 9.0,
      slopeParameter: 10,
      isInterstellar: false,
      epochJD: currentJD,
    },
    {
      designation: '2P',
      name: 'Encke',
      perihelionDistance: 0.336,
      eccentricity: 0.847,
      inclination: 11.8,
      longitudeOfAscendingNode: 334.6,
      argumentOfPerihelion: 186.5,
      perihelionTime: 2460224.5, // Oct 2023
      absoluteMagnitude: 10.0,
      slopeParameter: 15,
      isInterstellar: false,
      epochJD: currentJD,
    },
  ];
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
    (nightInfo.astronomicalDusk.getTime() + nightInfo.astronomicalDawn.getTime()) / 2
  );
  const jd = midnight.getTime() / 86400000 + 2440587.5;

  // Calculate comet position
  const pos = calculateCometPosition(comet, jd);
  const { ra, dec, distance: earthDist } = heliocentricToEquatorial(pos.x, pos.y, pos.z, jd);

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
    pos.r,
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
    }
  );

  // Skip if not visible
  if (!visibility.isVisible) {
    return null;
  }

  return visibility;
}
