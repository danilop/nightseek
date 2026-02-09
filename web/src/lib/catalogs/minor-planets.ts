import type { NightInfo, ObjectVisibility } from '@/types';
import type { SkyCalculator } from '../astronomy/calculator';
import { AU_TO_KM, RADIANS_TO_ARCSEC } from '../astronomy/constants';
import {
  getEarthPosition,
  meanMotion,
  orbitalToEcliptic,
  solveKepler,
} from '../astronomy/orbital-mechanics';

/**
 * Minor planet data structure
 */
export interface MinorPlanetData {
  designation: string;
  name: string;
  category: 'dwarf_planet' | 'asteroid';
  // Orbital elements (J2000 epoch)
  semiMajorAxis: number; // AU
  eccentricity: number;
  inclination: number; // degrees
  longitudeOfAscendingNode: number; // degrees
  argumentOfPerihelion: number; // degrees
  meanAnomalyAtEpoch: number; // degrees
  epochJD: number; // Julian date of epoch
  // Physical properties
  absoluteMagnitude: number; // H magnitude
  physicalDiameter: number; // km (for apparent size calculation)
}

/**
 * Dwarf planets orbital elements (J2000.0 epoch, approximate)
 */
export const DWARF_PLANETS: MinorPlanetData[] = [
  {
    designation: '134340',
    name: 'Pluto',
    category: 'dwarf_planet',
    semiMajorAxis: 39.482,
    eccentricity: 0.2488,
    inclination: 17.16,
    longitudeOfAscendingNode: 110.3,
    argumentOfPerihelion: 113.76,
    meanAnomalyAtEpoch: 14.53,
    epochJD: 2451545.0, // J2000.0
    absoluteMagnitude: -0.7,
    physicalDiameter: 2376,
  },
  {
    designation: '1',
    name: 'Ceres',
    category: 'dwarf_planet',
    semiMajorAxis: 2.7675,
    eccentricity: 0.0758,
    inclination: 10.59,
    longitudeOfAscendingNode: 80.33,
    argumentOfPerihelion: 73.6,
    meanAnomalyAtEpoch: 77.37,
    epochJD: 2451545.0,
    absoluteMagnitude: 3.34,
    physicalDiameter: 939,
  },
  {
    designation: '136199',
    name: 'Eris',
    category: 'dwarf_planet',
    semiMajorAxis: 67.864,
    eccentricity: 0.4407,
    inclination: 44.04,
    longitudeOfAscendingNode: 35.87,
    argumentOfPerihelion: 151.64,
    meanAnomalyAtEpoch: 205.99,
    epochJD: 2451545.0,
    absoluteMagnitude: -1.2,
    physicalDiameter: 2326,
  },
  {
    designation: '136472',
    name: 'Makemake',
    category: 'dwarf_planet',
    semiMajorAxis: 45.43,
    eccentricity: 0.161,
    inclination: 29.0,
    longitudeOfAscendingNode: 79.36,
    argumentOfPerihelion: 298.83,
    meanAnomalyAtEpoch: 85.13,
    epochJD: 2451545.0,
    absoluteMagnitude: -0.3,
    physicalDiameter: 1430,
  },
  {
    designation: '136108',
    name: 'Haumea',
    category: 'dwarf_planet',
    semiMajorAxis: 43.116,
    eccentricity: 0.1951,
    inclination: 28.19,
    longitudeOfAscendingNode: 121.79,
    argumentOfPerihelion: 240.21,
    meanAnomalyAtEpoch: 218.21,
    epochJD: 2451545.0,
    absoluteMagnitude: 0.2,
    physicalDiameter: 1632,
  },
];

/**
 * Notable asteroids orbital elements (J2000.0 epoch, approximate)
 */
export const NOTABLE_ASTEROIDS: MinorPlanetData[] = [
  {
    designation: '4',
    name: 'Vesta',
    category: 'asteroid',
    semiMajorAxis: 2.3615,
    eccentricity: 0.0887,
    inclination: 7.14,
    longitudeOfAscendingNode: 103.85,
    argumentOfPerihelion: 149.84,
    meanAnomalyAtEpoch: 20.86,
    epochJD: 2451545.0,
    absoluteMagnitude: 3.2,
    physicalDiameter: 525,
  },
  {
    designation: '2',
    name: 'Pallas',
    category: 'asteroid',
    semiMajorAxis: 2.772,
    eccentricity: 0.2305,
    inclination: 34.83,
    longitudeOfAscendingNode: 173.09,
    argumentOfPerihelion: 310.04,
    meanAnomalyAtEpoch: 96.15,
    epochJD: 2451545.0,
    absoluteMagnitude: 4.13,
    physicalDiameter: 512,
  },
  {
    designation: '3',
    name: 'Juno',
    category: 'asteroid',
    semiMajorAxis: 2.67,
    eccentricity: 0.2562,
    inclination: 12.98,
    longitudeOfAscendingNode: 169.85,
    argumentOfPerihelion: 247.84,
    meanAnomalyAtEpoch: 115.42,
    epochJD: 2451545.0,
    absoluteMagnitude: 5.33,
    physicalDiameter: 233,
  },
  {
    designation: '10',
    name: 'Hygiea',
    category: 'asteroid',
    semiMajorAxis: 3.1421,
    eccentricity: 0.1146,
    inclination: 3.84,
    longitudeOfAscendingNode: 283.2,
    argumentOfPerihelion: 312.32,
    meanAnomalyAtEpoch: 156.08,
    epochJD: 2451545.0,
    absoluteMagnitude: 5.43,
    physicalDiameter: 434,
  },
];

/**
 * Calculate minor planet position at a given Julian date
 */
export function calculateMinorPlanetPosition(
  mp: MinorPlanetData,
  julianDate: number
): { x: number; y: number; z: number; r: number; earthDist: number; ra: number; dec: number } {
  const {
    semiMajorAxis: a,
    eccentricity: e,
    inclination: i,
    longitudeOfAscendingNode: Omega,
    argumentOfPerihelion: omega,
    meanAnomalyAtEpoch: M0,
    epochJD,
  } = mp;

  // Convert angles to radians
  const iRad = (i * Math.PI) / 180;
  const OmegaRad = (Omega * Math.PI) / 180;
  const omegaRad = (omega * Math.PI) / 180;
  const M0Rad = (M0 * Math.PI) / 180;

  // Days since epoch
  const dt = julianDate - epochJD;

  // Mean anomaly at current time
  const n = meanMotion(a);
  let M = M0Rad + n * dt;
  // Normalize to 0-2π
  M %= 2 * Math.PI;
  if (M < 0) M += 2 * Math.PI;

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKepler(M, e);

  // True anomaly
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));

  // Distance from Sun
  const r = a * (1 - e * Math.cos(E));

  // Position in orbital plane → heliocentric ecliptic
  const xOrbital = r * Math.cos(nu);
  const yOrbital = r * Math.sin(nu);
  const { x, y, z } = orbitalToEcliptic(xOrbital, yOrbital, omegaRad, OmegaRad, iRad);

  // Get Earth's position and convert to equatorial
  const earth = getEarthPosition(julianDate);
  const geoX = x - earth.x;
  const geoY = y - earth.y;
  const geoZ = z - earth.z;

  const earthDist = Math.sqrt(geoX * geoX + geoY * geoY + geoZ * geoZ);

  // Obliquity of ecliptic
  const eps = (23.4393 * Math.PI) / 180;

  // Convert to equatorial
  const eqX = geoX;
  const eqY = geoY * Math.cos(eps) - geoZ * Math.sin(eps);
  const eqZ = geoY * Math.sin(eps) + geoZ * Math.cos(eps);

  let ra = (Math.atan2(eqY, eqX) * 180) / Math.PI;
  if (ra < 0) ra += 360;
  const sinDec = Math.max(-1, Math.min(1, eqZ / earthDist));
  const dec = (Math.asin(sinDec) * 180) / Math.PI;

  return { x, y, z, r, earthDist, ra: ra / 15, dec };
}

/**
 * Calculate apparent magnitude for a minor planet
 * Uses the H-G magnitude system
 * m = H + 5*log10(r*Δ) - 2.5*log10((1-G)*φ1 + G*φ2)
 * Simplified: m ≈ H + 5*log10(r*Δ)
 */
export function calculateMinorPlanetMagnitude(
  absoluteMagnitude: number,
  sunDistanceAU: number,
  earthDistanceAU: number
): number {
  if (sunDistanceAU <= 0 || earthDistanceAU <= 0) return 99.0;

  // Simplified magnitude without phase correction
  // Full formula would include phase function φ(α)
  return absoluteMagnitude + 5 * Math.log10(sunDistanceAU * earthDistanceAU);
}

/**
 * Calculate apparent diameter in arcseconds
 */
function calculateApparentDiameter(physicalDiameterKm: number, distanceAU: number): number {
  if (distanceAU <= 0) return 0;
  const distanceKm = distanceAU * AU_TO_KM;
  const angularDiameterRad = physicalDiameterKm / distanceKm;
  return angularDiameterRad * RADIANS_TO_ARCSEC;
}

/**
 * Calculate visibility for a minor planet
 */
export function calculateMinorPlanetVisibility(
  mp: MinorPlanetData,
  calculator: SkyCalculator,
  nightInfo: NightInfo,
  maxMagnitude: number = 12.0
): ObjectVisibility | null {
  // Get Julian date for midnight
  const midnight = new Date(
    (nightInfo.astronomicalDusk.getTime() + nightInfo.astronomicalDawn.getTime()) / 2
  );
  const jd = midnight.getTime() / 86400000 + 2440587.5;

  // Calculate position
  const pos = calculateMinorPlanetPosition(mp, jd);

  // Skip if position calculation produced invalid values
  if (
    !Number.isFinite(pos.ra) ||
    !Number.isFinite(pos.dec) ||
    !Number.isFinite(pos.earthDist) ||
    pos.earthDist <= 0
  ) {
    return null;
  }

  // Calculate apparent magnitude
  const apparentMag = calculateMinorPlanetMagnitude(mp.absoluteMagnitude, pos.r, pos.earthDist);

  // Skip if too faint
  if (apparentMag > maxMagnitude) {
    return null;
  }

  // Calculate visibility using the sky calculator
  const visibility = calculator.calculateVisibility(
    pos.ra,
    pos.dec,
    nightInfo,
    mp.name,
    mp.category,
    {
      magnitude: apparentMag,
      commonName: mp.name,
    }
  );

  // Skip if not visible
  if (!visibility.isVisible) {
    return null;
  }

  // Add apparent diameter
  visibility.apparentDiameterArcsec = calculateApparentDiameter(mp.physicalDiameter, pos.earthDist);

  return visibility;
}

/**
 * Get dwarf planets only
 */
export function getDwarfPlanets(): MinorPlanetData[] {
  return DWARF_PLANETS;
}

/**
 * Get notable asteroids only
 */
export function getNotableAsteroids(): MinorPlanetData[] {
  return NOTABLE_ASTEROIDS;
}
