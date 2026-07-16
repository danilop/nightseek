import * as Astronomy from 'astronomy-engine';
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
    // This is close to the large-|M| solution and avoids overflowing
    // sinh/cosh for fast interstellar trajectories.
    let H = Math.asinh(M / e);
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

/** Get Earth's VSOP heliocentric position in the J2000 ecliptic frame. */
export function getEarthPosition(julianDate: number): { x: number; y: number; z: number } {
  const date = new Date((julianDate - 2440587.5) * 86400000);
  const earthEqj = Astronomy.HelioVector(Astronomy.Body.Earth, date);
  const earthEcliptic = Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECL(), earthEqj);
  return { x: earthEcliptic.x, y: earthEcliptic.y, z: earthEcliptic.z };
}

export interface LightTimeCorrectedPosition {
  ra: number;
  dec: number;
  distance: number;
  emissionJulianDate: number;
}

/**
 * Convert a moving heliocentric ecliptic orbit to an astrometric geocentric
 * position, iterating the object's emission time for light travel.
 */
export function lightTimeCorrectedEquatorial(
  positionAtJulianDate: (julianDate: number) => { x: number; y: number; z: number },
  observationJulianDate: number
): LightTimeCorrectedPosition {
  const observationDate = new Date((observationJulianDate - 2440587.5) * 86400000);
  const observationTime = new Astronomy.AstroTime(observationDate);
  const earthEqj = Astronomy.HelioVector(Astronomy.Body.Earth, observationTime);
  let emissionJulianDate = observationJulianDate;
  let geo = new Astronomy.Vector(0, 0, 0, observationTime);

  for (let iteration = 0; iteration < 8; iteration++) {
    const objectEcliptic = positionAtJulianDate(emissionJulianDate);
    const objectEqj = Astronomy.RotateVector(
      Astronomy.Rotation_ECL_EQJ(),
      new Astronomy.Vector(objectEcliptic.x, objectEcliptic.y, objectEcliptic.z, observationTime)
    );
    geo = new Astronomy.Vector(
      objectEqj.x - earthEqj.x,
      objectEqj.y - earthEqj.y,
      objectEqj.z - earthEqj.z,
      observationTime
    );
    const nextEmissionJulianDate = observationJulianDate - geo.Length() / Astronomy.C_AUDAY;
    if (Math.abs(nextEmissionJulianDate - emissionJulianDate) < 1e-10) {
      emissionJulianDate = nextEmissionJulianDate;
      break;
    }
    emissionJulianDate = nextEmissionJulianDate;
  }

  const equator = Astronomy.EquatorFromVector(geo);
  return {
    ra: equator.ra,
    dec: equator.dec,
    distance: geo.Length(),
    emissionJulianDate,
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
  const date = new Date((julianDate - 2440587.5) * 86400000);
  const time = new Astronomy.AstroTime(date);
  const eclipticVector = new Astronomy.Vector(helioX, helioY, helioZ, time);
  const objectEqj = Astronomy.RotateVector(Astronomy.Rotation_ECL_EQJ(), eclipticVector);
  const earthEqj = Astronomy.HelioVector(Astronomy.Body.Earth, time);

  // Geocentric J2000 position using Astronomy Engine's VSOP Earth ephemeris.
  const geoX = objectEqj.x - earthEqj.x;
  const geoY = objectEqj.y - earthEqj.y;
  const geoZ = objectEqj.z - earthEqj.z;

  // Distance from Earth
  const distance = Math.sqrt(geoX * geoX + geoY * geoY + geoZ * geoZ);

  // RA and Dec
  let ra = (Math.atan2(geoY, geoX) * 180) / Math.PI;
  if (ra < 0) ra += 360;
  // Clamp to [-1, 1] to handle floating point precision issues
  const sinDec = Math.max(-1, Math.min(1, geoZ / distance));
  const dec = (Math.asin(sinDec) * 180) / Math.PI;

  return { ra: ra / 15, dec, distance }; // ra in hours
}

/**
 * Calculate mean motion in radians per day for a given semi-major axis.
 */
export function meanMotion(semiMajorAxisAU: number): number {
  return GAUSSIAN_GRAVITATIONAL_CONSTANT / Math.abs(semiMajorAxisAU) ** 1.5;
}
