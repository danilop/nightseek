import cometsJson from '@/data/comets.json';
import dataMeta from '@/data/meta.json';
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
import { hasMagnitude } from '../utils/magnitude';
import { isInterstellarDesignation, type ParsedComet, parseMPCCometLine } from './mpc-comet';

export { isInterstellarDesignation, type ParsedComet, parseMPCCometLine } from './mpc-comet';

// MPC Comet data URL - we'll use a CORS proxy or fetch directly
const MPC_COMET_URL = 'https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt';

function normalizeComet(comet: ParsedComet): ParsedComet {
  return { ...comet, isInterstellar: isInterstellarDesignation(comet.designation) };
}

/** MPC uses exponent n: m = H + 5 log10(delta) + 2.5 n log10(r).
 * JPL's k1 convention already includes 2.5; do not interchange those parameters.
 * See docs/photometry.md for the source convention and limitations.
 */
export function calculateCometMagnitude(
  absoluteMag: number | null,
  earthDistanceAU: number,
  sunDistanceAU: number,
  slopeParameter: number | null
): number | null {
  if (
    !hasMagnitude(absoluteMag) ||
    !hasMagnitude(slopeParameter) ||
    !Number.isFinite(earthDistanceAU) ||
    !Number.isFinite(sunDistanceAU) ||
    earthDistanceAU <= 0 ||
    sunDistanceAU <= 0
  )
    return null;
  return (
    absoluteMag + 5 * Math.log10(earthDistanceAU) + 2.5 * slopeParameter * Math.log10(sunDistanceAU)
  );
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
    return cached
      .map(normalizeComet)
      .filter(c => !hasMagnitude(c.absoluteMagnitude) || c.absoluteMagnitude <= maxMagnitude + 5);
  }

  // Use bundled static data
  const staticComets: ParsedComet[] = (cometsJson as unknown as ParsedComet[]).map(comet => ({
    ...comet,
    dataRetrievedAt: dataMeta.sources['comets.json'],
  }));
  if (staticComets && staticComets.length > 0) {
    await setCache(CACHE_KEYS.COMETS, staticComets);
    return staticComets
      .map(normalizeComet)
      .filter(c => !hasMagnitude(c.absoluteMagnitude) || c.absoluteMagnitude <= maxMagnitude + 5);
  }

  // Fallback: try fetching directly from MPC
  try {
    const response = await fetch(MPC_COMET_URL, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) {
      throw new Error(`Failed to fetch comet data: ${response.status}`);
    }

    const text = await response.text();
    const lines = text.split('\n');
    const comets: ParsedComet[] = [];

    for (const line of lines) {
      const comet = parseMPCCometLine(line);
      if (comet) {
        comets.push({ ...comet, dataRetrievedAt: new Date().toISOString() });
      }
    }

    await setCache(CACHE_KEYS.COMETS, comets);
    return comets.filter(
      c => !hasMagnitude(c.absoluteMagnitude) || c.absoluteMagnitude <= maxMagnitude + 5
    );
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
  maxMagnitude: number = 12.0,
  includeInvisible = false
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
  if (apparentMag !== null && apparentMag > maxMagnitude) {
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

  visibility.magnitudeSource = `MPC brightness model · observing-window midpoint${comet.dataRetrievedAt ? ` · elements retrieved ${comet.dataRetrievedAt.slice(0, 10)} UTC` : ''}`;

  // Skip if not visible
  if (!includeInvisible && !visibility.isVisible) {
    return null;
  }

  return visibility;
}
