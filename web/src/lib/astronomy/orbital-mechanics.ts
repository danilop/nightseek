import { GAUSSIAN_GRAVITATIONAL_CONSTANT } from './constants';

/**
 * Solve Kepler's equation for eccentric anomaly.
 * Supports both elliptical (e < 1) and hyperbolic (e >= 1) orbits.
 * Uses Newton-Raphson iteration.
 */
export function solveKepler(
  meanAnomaly: number,
  eccentricity: number,
  maxIterations = 50,
  tolerance = 1e-12
): number {
  const M = meanAnomaly;
  const e = eccentricity;

  if (e >= 1) {
    // Hyperbolic orbit: M = e*sinh(H) - H
    let H = M;
    for (let i = 0; i < maxIterations; i++) {
      const dH = (e * Math.sinh(H) - H - M) / (e * Math.cosh(H) - 1);
      H -= dH;
      if (Math.abs(dH) < tolerance) break;
    }
    return H;
  }

  // Elliptical orbit: M = E - e*sin(E)
  let E = M;
  for (let i = 0; i < maxIterations; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tolerance) break;
  }
  return E;
}

/**
 * Get Earth's heliocentric ecliptic position at a given Julian date.
 * Uses simplified mean orbital elements with time-varying eccentricity.
 */
export function getEarthPosition(julianDate: number): { x: number; y: number; z: number } {
  const T = (julianDate - 2451545.0) / 36525; // Julian centuries from J2000

  // Mean longitude of Earth
  const L = ((100.46646 + 36000.76983 * T) * Math.PI) / 180;

  // Earth's orbital elements (with time-varying eccentricity)
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
 * Transform orbital plane coordinates to heliocentric ecliptic coordinates.
 * Applies the three Euler-angle rotation matrices.
 */
export function orbitalToEcliptic(
  xOrbital: number,
  yOrbital: number,
  omegaRad: number,
  OmegaRad: number,
  iRad: number
): { x: number; y: number; z: number } {
  const cosOmega = Math.cos(OmegaRad);
  const sinOmega = Math.sin(OmegaRad);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);
  const cosOmegaArg = Math.cos(omegaRad);
  const sinOmegaArg = Math.sin(omegaRad);

  const x =
    (cosOmega * cosOmegaArg - sinOmega * sinOmegaArg * cosI) * xOrbital +
    (-cosOmega * sinOmegaArg - sinOmega * cosOmegaArg * cosI) * yOrbital;
  const y =
    (sinOmega * cosOmegaArg + cosOmega * sinOmegaArg * cosI) * xOrbital +
    (-sinOmega * sinOmegaArg + cosOmega * cosOmegaArg * cosI) * yOrbital;
  const z = sinOmegaArg * sinI * xOrbital + cosOmegaArg * sinI * yOrbital;

  return { x, y, z };
}

/**
 * Convert heliocentric ecliptic coordinates to equatorial RA/Dec.
 */
export function heliocentricToEquatorial(
  helioX: number,
  helioY: number,
  helioZ: number,
  julianDate: number
): { ra: number; dec: number; distance: number } {
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
 * Calculate mean motion in radians per day for a given semi-major axis.
 */
export function meanMotion(semiMajorAxisAU: number): number {
  return GAUSSIAN_GRAVITATIONAL_CONSTANT / Math.abs(semiMajorAxisAU) ** 1.5;
}
