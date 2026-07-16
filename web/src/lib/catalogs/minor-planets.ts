import * as Astronomy from 'astronomy-engine';
import type { NightInfo, ObjectVisibility } from '@/types';
import type { SkyCalculator } from '../astronomy/calculator';
import { AU_TO_KM, RADIANS_TO_ARCSEC } from '../astronomy/constants';
import {
  lightTimeCorrectedEquatorial,
  meanMotion,
  orbitalToEcliptic,
  solveKepler,
} from '../astronomy/orbital-mechanics';

function calculateMinorPlanetHeliocentric(
  mp: MinorPlanetData,
  julianDate: number
): { x: number; y: number; z: number; r: number } {
  const {
    semiMajorAxis: a,
    eccentricity: e,
    inclination: i,
    longitudeOfAscendingNode: Omega,
    argumentOfPerihelion: omega,
    meanAnomalyAtEpoch: M0,
    epochJD,
  } = mp;
  const iRad = (i * Math.PI) / 180;
  const OmegaRad = (Omega * Math.PI) / 180;
  const omegaRad = (omega * Math.PI) / 180;
  const M0Rad = (M0 * Math.PI) / 180;
  const n = meanMotion(a);
  let meanAnomaly = M0Rad + n * (julianDate - epochJD);
  meanAnomaly %= 2 * Math.PI;
  if (meanAnomaly < 0) meanAnomaly += 2 * Math.PI;

  const eccentricAnomaly = solveKepler(meanAnomaly, e);
  const trueAnomaly =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(eccentricAnomaly / 2),
      Math.sqrt(1 - e) * Math.cos(eccentricAnomaly / 2)
    );
  const r = a * (1 - e * Math.cos(eccentricAnomaly));
  const position = orbitalToEcliptic(
    r * Math.cos(trueAnomaly),
    r * Math.sin(trueAnomaly),
    omegaRad,
    OmegaRad,
    iRad
  );
  return { ...position, r };
}

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
  slopeParameter?: number; // IAU H-G parameter when measured
  physicalDiameter: number; // km (for apparent size calculation)
}

/**
 * Dwarf-planet osculating elements from JPL SBDB, equinox J2000.
 */
export const DWARF_PLANETS: MinorPlanetData[] = [
  {
    designation: '134340',
    name: 'Pluto',
    category: 'dwarf_planet',
    semiMajorAxis: 39.58862938517124,
    eccentricity: 0.2518378778576892,
    inclination: 17.14771140999114,
    longitudeOfAscendingNode: 110.2923840543057,
    argumentOfPerihelion: 113.7090015158565,
    meanAnomalyAtEpoch: 38.68366347318184,
    epochJD: 2457588.5,
    absoluteMagnitude: -0.7,
    physicalDiameter: 2376,
  },
  {
    designation: '1',
    name: 'Ceres',
    category: 'dwarf_planet',
    semiMajorAxis: 2.765552595034094,
    eccentricity: 0.07969229514816586,
    inclination: 10.58802780183462,
    longitudeOfAscendingNode: 80.24862682043221,
    argumentOfPerihelion: 73.29421453021587,
    meanAnomalyAtEpoch: 274.4193463761342,
    epochJD: 2461200.5,
    absoluteMagnitude: 3.34,
    slopeParameter: 0.12,
    physicalDiameter: 939,
  },
  {
    designation: '136199',
    name: 'Eris',
    category: 'dwarf_planet',
    semiMajorAxis: 67.93394687853566,
    eccentricity: 0.4382385347971672,
    inclination: 43.9258279471791,
    longitudeOfAscendingNode: 36.00477044417249,
    argumentOfPerihelion: 150.7949235840312,
    meanAnomalyAtEpoch: 211.774434275007,
    epochJD: 2461200.5,
    absoluteMagnitude: -1.2,
    physicalDiameter: 2326,
  },
  {
    designation: '136472',
    name: 'Makemake',
    category: 'dwarf_planet',
    semiMajorAxis: 45.57093317300052,
    eccentricity: 0.1588889953992523,
    inclination: 29.02785603743067,
    longitudeOfAscendingNode: 79.2948338209406,
    argumentOfPerihelion: 297.0922733397207,
    meanAnomalyAtEpoch: 169.9379962048232,
    epochJD: 2461200.5,
    absoluteMagnitude: -0.3,
    physicalDiameter: 1430,
  },
  {
    designation: '136108',
    name: 'Haumea',
    category: 'dwarf_planet',
    semiMajorAxis: 43.06029023650952,
    eccentricity: 0.1944430148898797,
    inclination: 28.20847393040364,
    longitudeOfAscendingNode: 121.7860561329425,
    argumentOfPerihelion: 240.6905472508661,
    meanAnomalyAtEpoch: 223.2104118812299,
    epochJD: 2461200.5,
    absoluteMagnitude: 0.2,
    physicalDiameter: 1632,
  },
];

/**
 * Notable asteroid osculating elements from JPL SBDB, epoch JD 2461200.5.
 */
export const NOTABLE_ASTEROIDS: MinorPlanetData[] = [
  {
    designation: '4',
    name: 'Vesta',
    category: 'asteroid',
    semiMajorAxis: 2.361365965127599,
    eccentricity: 0.09020374382834395,
    inclination: 7.143925545058711,
    longitudeOfAscendingNode: 103.701293265032,
    argumentOfPerihelion: 151.4686478221564,
    meanAnomalyAtEpoch: 81.19015607686903,
    epochJD: 2461200.5,
    absoluteMagnitude: 3.2,
    slopeParameter: 0.32,
    physicalDiameter: 525,
  },
  {
    designation: '2',
    name: 'Pallas',
    category: 'asteroid',
    semiMajorAxis: 2.769559010737709,
    eccentricity: 0.2307000995648547,
    inclination: 34.93279321851542,
    longitudeOfAscendingNode: 172.8866193357694,
    argumentOfPerihelion: 310.9699161652136,
    meanAnomalyAtEpoch: 254.2496521742734,
    epochJD: 2461200.5,
    absoluteMagnitude: 4.13,
    slopeParameter: 0.11,
    physicalDiameter: 512,
  },
  {
    designation: '3',
    name: 'Juno',
    category: 'asteroid',
    semiMajorAxis: 2.670989527103278,
    eccentricity: 0.2556999836681878,
    inclination: 12.98659236598085,
    longitudeOfAscendingNode: 169.8115953492418,
    argumentOfPerihelion: 247.8950743075613,
    meanAnomalyAtEpoch: 262.7322944883855,
    epochJD: 2461200.5,
    absoluteMagnitude: 5.33,
    slopeParameter: 0.32,
    physicalDiameter: 233,
  },
  {
    designation: '10',
    name: 'Hygiea',
    category: 'asteroid',
    semiMajorAxis: 3.150974033963701,
    eccentricity: 0.1067092741240963,
    inclination: 3.829529946447122,
    longitudeOfAscendingNode: 283.1198927508594,
    argumentOfPerihelion: 312.4242387344704,
    meanAnomalyAtEpoch: 252.0344242359649,
    epochJD: 2461200.5,
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
  if (mp.name === 'Pluto') {
    const date = new Date((julianDate - 2440587.5) * 86400000);
    const helio = Astronomy.HelioVector(Astronomy.Body.Pluto, date);
    const geo = Astronomy.GeoVector(Astronomy.Body.Pluto, date, true);
    const equator = Astronomy.EquatorFromVector(geo);
    return {
      x: helio.x,
      y: helio.y,
      z: helio.z,
      r: helio.Length(),
      earthDist: geo.Length(),
      ra: equator.ra,
      dec: equator.dec,
    };
  }

  const equator = lightTimeCorrectedEquatorial(
    sampleJD => calculateMinorPlanetHeliocentric(mp, sampleJD),
    julianDate
  );
  const emittedPosition = calculateMinorPlanetHeliocentric(mp, equator.emissionJulianDate);
  return {
    ...emittedPosition,
    earthDist: equator.distance,
    ra: equator.ra,
    dec: equator.dec,
  };
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
  phaseAngleDegrees: number = 0,
  slopeParameter: number = 0.15
): number {
  if (sunDistanceAU <= 0 || earthDistanceAU <= 0) return 99.0;

  const alpha = Math.max(0, Math.min(180, phaseAngleDegrees)) * (Math.PI / 180);
  const tanHalfAlpha = Math.tan(alpha / 2);
  const phi1 = Math.exp(-3.33 * tanHalfAlpha ** 0.63);
  const phi2 = Math.exp(-1.87 * tanHalfAlpha ** 1.22);
  const phaseFunction = (1 - slopeParameter) * phi1 + slopeParameter * phi2;
  if (phaseFunction <= 0) return 99.0;

  return (
    absoluteMagnitude +
    5 * Math.log10(sunDistanceAU * earthDistanceAU) -
    2.5 * Math.log10(phaseFunction)
  );
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
    (nightInfo.observingWindowStart.getTime() + nightInfo.observingWindowEnd.getTime()) / 2
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
  const earthSunDistance = Astronomy.HelioDistance(Astronomy.Body.Earth, midnight);
  const cosPhase = Math.max(
    -1,
    Math.min(
      1,
      (pos.r ** 2 + pos.earthDist ** 2 - earthSunDistance ** 2) / (2 * pos.r * pos.earthDist)
    )
  );
  const phaseAngle = (Math.acos(cosPhase) * 180) / Math.PI;
  const apparentMag = calculateMinorPlanetMagnitude(
    mp.absoluteMagnitude,
    pos.r,
    pos.earthDist,
    phaseAngle,
    mp.slopeParameter ?? 0.15
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
      positionAtTime: time => {
        const sampleJD = time.getTime() / 86400000 + 2440587.5;
        const sample = calculateMinorPlanetPosition(mp, sampleJD);
        return { raHours: sample.ra, decDegrees: sample.dec };
      },
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
