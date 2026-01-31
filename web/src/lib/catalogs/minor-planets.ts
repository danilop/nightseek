import type { ObjectVisibility, NightInfo } from '@/types';
import { SkyCalculator } from '../astronomy/calculator';

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
    longitudeOfAscendingNode: 110.30,
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
    argumentOfPerihelion: 73.60,
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
    semiMajorAxis: 45.430,
    eccentricity: 0.1610,
    inclination: 29.00,
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
    semiMajorAxis: 2.7720,
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
    semiMajorAxis: 2.6700,
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
    longitudeOfAscendingNode: 283.20,
    argumentOfPerihelion: 312.32,
    meanAnomalyAtEpoch: 156.08,
    epochJD: 2451545.0,
    absoluteMagnitude: 5.43,
    physicalDiameter: 434,
  },
];

/**
 * Solve Kepler's equation for eccentric anomaly
 * M = E - e*sin(E) using Newton-Raphson iteration
 */
function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let E = meanAnomaly;
  for (let i = 0; i < 30; i++) {
    const dE = (E - eccentricity * Math.sin(E) - meanAnomaly) / (1 - eccentricity * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/**
 * Calculate minor planet position at a given Julian date
 */
export function calculateMinorPlanetPosition(
  mp: MinorPlanetData,
  julianDate: number
): { x: number; y: number; z: number; r: number; earthDist: number; ra: number; dec: number } {
  const { semiMajorAxis: a, eccentricity: e, inclination: i,
          longitudeOfAscendingNode: Omega, argumentOfPerihelion: omega,
          meanAnomalyAtEpoch: M0, epochJD } = mp;

  // Convert angles to radians
  const iRad = i * Math.PI / 180;
  const OmegaRad = Omega * Math.PI / 180;
  const omegaRad = omega * Math.PI / 180;
  const M0Rad = M0 * Math.PI / 180;

  // Days since epoch
  const dt = julianDate - epochJD;

  // Mean motion (radians per day)
  const k = 0.01720209895; // Gaussian gravitational constant
  const n = k / Math.pow(a, 1.5);

  // Mean anomaly at current time
  let M = M0Rad + n * dt;
  // Normalize to 0-2π
  M = M % (2 * Math.PI);
  if (M < 0) M += 2 * Math.PI;

  // Solve Kepler's equation for eccentric anomaly
  const E = solveKepler(M, e);

  // True anomaly
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );

  // Distance from Sun
  const r = a * (1 - e * Math.cos(E));

  // Position in orbital plane
  const xOrbital = r * Math.cos(nu);
  const yOrbital = r * Math.sin(nu);

  // Rotation matrices to heliocentric ecliptic coordinates
  const cosOmega = Math.cos(OmegaRad);
  const sinOmega = Math.sin(OmegaRad);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);
  const cosOmegaArg = Math.cos(omegaRad);
  const sinOmegaArg = Math.sin(omegaRad);

  const x = (cosOmega * cosOmegaArg - sinOmega * sinOmegaArg * cosI) * xOrbital +
            (-cosOmega * sinOmegaArg - sinOmega * cosOmegaArg * cosI) * yOrbital;
  const y = (sinOmega * cosOmegaArg + cosOmega * sinOmegaArg * cosI) * xOrbital +
            (-sinOmega * sinOmegaArg + cosOmega * cosOmegaArg * cosI) * yOrbital;
  const z = (sinOmegaArg * sinI) * xOrbital + (cosOmegaArg * sinI) * yOrbital;

  // Get Earth's position (simplified)
  const T = (julianDate - 2451545.0) / 36525;
  const earthL = (100.46646 + 36000.76983 * T) * Math.PI / 180;
  const earthM = (357.52911 + 35999.05029 * T) * Math.PI / 180;
  const earthC = (1.9146 * Math.sin(earthM) + 0.019993 * Math.sin(2 * earthM)) * Math.PI / 180;
  const earthR = 1.00000261 * (1 - 0.01671123 * 0.01671123) / (1 + 0.01671123 * Math.cos(earthM + earthC));
  const earthLon = earthL + earthC;
  const earthX = earthR * Math.cos(earthLon);
  const earthY = earthR * Math.sin(earthLon);

  // Geocentric position
  const geoX = x - earthX;
  const geoY = y - earthY;
  const geoZ = z; // Earth Z is ~0

  // Distance from Earth
  const earthDist = Math.sqrt(geoX * geoX + geoY * geoY + geoZ * geoZ);

  // Obliquity of ecliptic
  const eps = 23.4393 * Math.PI / 180;

  // Convert to equatorial
  const eqX = geoX;
  const eqY = geoY * Math.cos(eps) - geoZ * Math.sin(eps);
  const eqZ = geoY * Math.sin(eps) + geoZ * Math.cos(eps);

  // RA and Dec
  let ra = Math.atan2(eqY, eqX) * 180 / Math.PI;
  if (ra < 0) ra += 360;
  const dec = Math.asin(eqZ / earthDist) * 180 / Math.PI;

  return { x, y, z, r, earthDist, ra: ra / 15, dec }; // ra in hours
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
  earthDistanceAU: number,
  _phaseAngle: number = 0 // degrees, simplified (unused but kept for API compatibility)
): number {
  if (sunDistanceAU <= 0 || earthDistanceAU <= 0) return 99.0;

  // Simplified magnitude without phase correction
  // Full formula would include phase function φ(α)
  return absoluteMagnitude + 5 * Math.log10(sunDistanceAU * earthDistanceAU);
}

/**
 * Calculate apparent diameter in arcseconds
 */
export function calculateApparentDiameter(
  physicalDiameterKm: number,
  distanceAU: number
): number {
  if (distanceAU <= 0) return 0;
  const distanceKm = distanceAU * 149597870.7;
  const angularDiameterRad = physicalDiameterKm / distanceKm;
  return angularDiameterRad * 206265; // radians to arcseconds
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

  // Calculate apparent magnitude
  const apparentMag = calculateMinorPlanetMagnitude(
    mp.absoluteMagnitude,
    pos.r,
    pos.earthDist
  );

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
 * Get all minor planets (dwarf planets + asteroids)
 */
export function getAllMinorPlanets(): MinorPlanetData[] {
  return [...DWARF_PLANETS, ...NOTABLE_ASTEROIDS];
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
