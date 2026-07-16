/**
 * Object Search Module
 *
 * Search for celestial objects by name/code and determine their visibility
 * from the observer's location. Efficiently handles:
 * - Deep Sky Objects (OpenNGC catalog)
 * - Planets
 * - Comets
 * - Dwarf Planets
 * - Asteroids
 */

import * as Astronomy from 'astronomy-engine';
import type {
  DSOCatalogEntry,
  Location,
  NightInfo,
  ObjectCategory,
  ObjectSearchResult,
  ObjectVisibility,
  ObjectVisibilityStatus,
} from '@/types';
import { SkyCalculator } from '../astronomy/calculator';
import {
  calculateCometMagnitude,
  calculateCometPosition,
  fetchComets,
  heliocentricToEquatorial,
  type ParsedComet,
} from '../catalogs/comets';
import {
  calculateMinorPlanetMagnitude,
  calculateMinorPlanetPosition,
  DWARF_PLANETS,
  type MinorPlanetData,
  NOTABLE_ASTEROIDS,
} from '../catalogs/minor-planets';
import { loadOpenNGCCatalog } from '../catalogs/opengc';
import {
  addAbsoluteDays,
  findFirstMatchingDay,
  getObserverNoon,
  getPlanetPosition,
} from './search-astronomy';

// Planets list
const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

// Minimum altitude threshold for "visibility"
const MIN_ALTITUDE = 30;

// Optimal altitude for good observing conditions
const OPTIMAL_ALTITUDE = 45;

// Maximum days to search ahead for visibility
const MAX_SEARCH_DAYS = 365;

type PositionGetter = (time: Date) => { ra: number; dec: number } | null;

/**
 * Check if an object can ever be visible from a given latitude
 * Based on declination constraints:
 * - Object at declination dec can reach max altitude = 90 - |lat - dec|
 * - For northern observers: objects with dec < lat - 90 never rise
 * - For southern observers: objects with dec > lat + 90 never rise
 */
function canObjectEverBeVisible(
  decDegrees: number,
  observerLatitude: number,
  minAltitude: number = MIN_ALTITUDE
): { canBeVisible: boolean; maxPossibleAltitude: number; reason: string | null } {
  const maxAlt = 90 - Math.abs(observerLatitude - decDegrees);

  if (maxAlt < 0) {
    return {
      canBeVisible: false,
      maxPossibleAltitude: maxAlt,
      reason: `Object never rises above the horizon at latitude ${observerLatitude.toFixed(1)}°`,
    };
  }

  if (maxAlt < minAltitude) {
    return {
      canBeVisible: false,
      maxPossibleAltitude: maxAlt,
      reason: `Object only reaches ${maxAlt.toFixed(1)}° altitude (below ${minAltitude}° minimum)`,
    };
  }

  return {
    canBeVisible: true,
    maxPossibleAltitude: maxAlt,
    reason: null,
  };
}

/**
 * Check if an object can ever reach optimal viewing altitude (45°+)
 */
function canObjectReachOptimal(
  decDegrees: number,
  observerLatitude: number,
  optimalAltitude: number = OPTIMAL_ALTITUDE
): { canReach: boolean; note: string | null } {
  const maxAlt = 90 - Math.abs(observerLatitude - decDegrees);

  if (maxAlt < optimalAltitude) {
    return {
      canReach: false,
      note: `Best altitude from your location: ${maxAlt.toFixed(0)}° (never reaches optimal ${optimalAltitude}°)`,
    };
  }

  return { canReach: true, note: null };
}

interface NightSearchMatch {
  date: Date;
  nightInfo: NightInfo;
  visibility: ObjectVisibility;
}

/**
 * Find the first night that reaches an altitude threshold.
 *
 * Visibility is not monotonic for moving bodies, polar darkness, or short
 * seasonal windows. Daily evaluation is therefore intentional: an
 * exponential/binary search can skip a real window entirely.
 */
async function findNextNightAtAltitude(
  getRaDec: PositionGetter,
  calculator: SkyCalculator,
  startDate: Date,
  threshold: number,
  maxDays: number = MAX_SEARCH_DAYS
): Promise<NightSearchMatch | null> {
  return findFirstMatchingDay(startDate, maxDays, checkDate => {
    const position = getRaDec(checkDate);
    if (!position) return null;

    const nightInfo = calculator.getNightInfo(checkDate);
    const { isVisible, visibility } = checkVisibilityForNight(
      position.ra,
      position.dec,
      calculator,
      nightInfo,
      threshold,
      getRaDec
    );
    if (isVisible && visibility) {
      return { date: checkDate, nightInfo, visibility };
    }
    return null;
  });
}

function findNextOptimalNight(
  getRaDec: PositionGetter,
  calculator: SkyCalculator,
  startDate: Date,
  maxDays: number = MAX_SEARCH_DAYS
): Promise<NightSearchMatch | null> {
  return findNextNightAtAltitude(getRaDec, calculator, startDate, OPTIMAL_ALTITUDE, maxDays);
}

/**
 * Get comet position at a given time
 */
function getCometPosition(
  comet: ParsedComet,
  time: Date
): { ra: number; dec: number; magnitude: number } | null {
  const jd = time.getTime() / 86400000 + 2440587.5;
  const pos = calculateCometPosition(comet, jd);
  const { ra, dec, distance: earthDist } = heliocentricToEquatorial(pos.x, pos.y, pos.z, jd);

  if (
    !Number.isFinite(ra) ||
    !Number.isFinite(dec) ||
    !Number.isFinite(earthDist) ||
    earthDist <= 0
  ) {
    return null;
  }

  const magnitude = calculateCometMagnitude(
    comet.absoluteMagnitude,
    earthDist,
    pos.r,
    comet.slopeParameter
  );

  return { ra, dec, magnitude };
}

/**
 * Get minor planet position at a given time
 */
function getMinorPlanetPosition(
  mp: MinorPlanetData,
  time: Date
): { ra: number; dec: number; magnitude: number } | null {
  const jd = time.getTime() / 86400000 + 2440587.5;
  const pos = calculateMinorPlanetPosition(mp, jd);

  if (!Number.isFinite(pos.ra) || !Number.isFinite(pos.dec) || pos.earthDist <= 0) {
    return null;
  }

  const magnitude = calculateMinorPlanetMagnitude(mp.absoluteMagnitude, pos.r, pos.earthDist);

  return { ra: pos.ra, dec: pos.dec, magnitude };
}

/**
 * Check if an object is visible during a given night
 */
function checkVisibilityForNight(
  raHours: number,
  decDegrees: number,
  calculator: SkyCalculator,
  nightInfo: NightInfo,
  minAltitude: number = MIN_ALTITUDE,
  positionAtTime?: PositionGetter
): { isVisible: boolean; visibility: ObjectVisibility | null } {
  // This declination shortcut is valid only for a fixed object. A planet,
  // comet, or minor planet can cross into the observable declination range.
  if (!positionAtTime) {
    const hemisphereCheck = canObjectEverBeVisible(
      decDegrees,
      calculator.getLatitude(),
      minAltitude
    );
    if (!hemisphereCheck.canBeVisible) {
      return { isVisible: false, visibility: null };
    }
  }

  // Full visibility calculation - samples altitude throughout the entire night
  // to find the true maximum (object may transit at any time, not just at midnight)
  const visibility = calculator.calculateVisibility(
    raHours,
    decDegrees,
    nightInfo,
    'search-object',
    'dso',
    positionAtTime
      ? {
          positionAtTime: time => {
            const position = positionAtTime(time);
            return position
              ? { raHours: position.ra, decDegrees: position.dec }
              : { raHours, decDegrees };
          },
        }
      : undefined
  );

  return {
    isVisible: visibility.maxAltitude >= minAltitude,
    visibility,
  };
}

/** Find the next night when an object reaches the search visibility threshold. */
function findNextVisibleNight(
  getRaDec: PositionGetter,
  calculator: SkyCalculator,
  startDate: Date,
  maxDays: number = MAX_SEARCH_DAYS
): Promise<NightSearchMatch | null> {
  return findNextNightAtAltitude(getRaDec, calculator, startDate, MIN_ALTITUDE, maxDays);
}

/**
 * Search for DSOs matching the query
 */
async function searchDSOs(query: string, catalog: DSOCatalogEntry[]): Promise<DSOCatalogEntry[]> {
  const lowerQuery = query.toLowerCase().trim();

  // Handle Messier designations: M1, M 1, m1, m 1, etc.
  const messierMatch = lowerQuery.match(/^m\s*(\d+)$/);
  if (messierMatch) {
    const messierNum = parseInt(messierMatch[1], 10);
    return catalog.filter(entry => entry.messierNumber === messierNum);
  }

  // Handle NGC/IC designations: NGC 224, NGC224, ngc 224, etc.
  const ngcMatch = lowerQuery.match(/^(ngc|ic)\s*(\d+)$/);
  if (ngcMatch) {
    const prefix = ngcMatch[1].toUpperCase();
    const num = ngcMatch[2];
    const searchName = `${prefix} ${num}`;
    return catalog.filter(
      entry =>
        entry.name.toLowerCase() === searchName.toLowerCase() ||
        entry.name.toLowerCase() === `${prefix}${num}`.toLowerCase()
    );
  }

  // General search: name, common name, or partial match
  return catalog.filter(entry => {
    if (entry.name.toLowerCase().includes(lowerQuery)) return true;
    if (entry.commonName?.toLowerCase().includes(lowerQuery)) return true;
    return false;
  });
}

/**
 * Search for planets matching the query
 */
function searchPlanets(query: string): string[] {
  const lowerQuery = query.toLowerCase().trim();
  return PLANETS.filter(p => p.toLowerCase().includes(lowerQuery));
}

/**
 * Search for comets matching the query
 */
function searchComets(query: string, comets: ParsedComet[]): ParsedComet[] {
  const lowerQuery = query.toLowerCase().trim();
  return comets.filter(
    c =>
      c.designation.toLowerCase().includes(lowerQuery) || c.name.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search for dwarf planets matching the query
 */
function searchDwarfPlanets(query: string): MinorPlanetData[] {
  const lowerQuery = query.toLowerCase().trim();
  return DWARF_PLANETS.filter(
    dp =>
      dp.name.toLowerCase().includes(lowerQuery) ||
      dp.designation.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search for asteroids matching the query
 */
function searchAsteroids(query: string): MinorPlanetData[] {
  const lowerQuery = query.toLowerCase().trim();
  return NOTABLE_ASTEROIDS.filter(
    a =>
      a.name.toLowerCase().includes(lowerQuery) || a.designation.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Create a search result for a DSO
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Astronomical search requires handling multiple visibility scenarios
async function createDSOSearchResult(
  dso: DSOCatalogEntry,
  calculator: SkyCalculator,
  tonight: NightInfo
): Promise<ObjectSearchResult> {
  const hemisphereCheck = canObjectEverBeVisible(dso.decDegrees, calculator.getLatitude());
  const optimalCheck = canObjectReachOptimal(dso.decDegrees, calculator.getLatitude());

  // Calculate angular size from major/minor axes
  const angularSize = dso.majorAxisArcmin || null;

  // DSOs have fixed coordinates
  const getRaDec = () => ({ ra: dso.raHours, dec: dso.decDegrees });

  if (!hemisphereCheck.canBeVisible) {
    return {
      objectName: dso.name,
      displayName: dso.commonName || dso.name,
      objectType: 'dso',
      subtype: dso.type,
      raHours: dso.raHours,
      decDegrees: dso.decDegrees,
      magnitude: dso.magnitude,
      constellation: dso.constellation || null,
      messierNumber: dso.messierNumber,
      visibilityStatus: 'never_visible',
      visibleTonight: false,
      nextVisibleDate: null,
      nextVisibleNightInfo: null,
      visibility: null,
      neverVisible: true,
      neverVisibleReason: hemisphereCheck.reason,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: false,
      angularSizeArcmin: angularSize,
      azimuthAtPeak: null,
      canReachOptimal: optimalCheck.canReach,
      optimalAltitudeNote: optimalCheck.note,
      nextOptimalDate: null,
    };
  }

  // Check tonight
  const tonightResult = checkVisibilityForNight(dso.raHours, dso.decDegrees, calculator, tonight);

  if (tonightResult.isVisible && tonightResult.visibility) {
    const isOptimalTonight = tonightResult.visibility.maxAltitude >= OPTIMAL_ALTITUDE;
    let nextOptimalDate: Date | null = null;

    // If visible but not optimal, find when it will be optimal
    if (!isOptimalTonight && optimalCheck.canReach) {
      const tomorrow = addAbsoluteDays(tonight.date, 1);
      const nextOptimal = await findNextOptimalNight(getRaDec, calculator, tomorrow);
      if (nextOptimal) {
        nextOptimalDate = nextOptimal.date;
      }
    }

    return {
      objectName: dso.name,
      displayName: dso.commonName || dso.name,
      objectType: 'dso',
      subtype: dso.type,
      raHours: dso.raHours,
      decDegrees: dso.decDegrees,
      magnitude: dso.magnitude,
      constellation: dso.constellation || null,
      messierNumber: dso.messierNumber,
      visibilityStatus: 'visible_tonight',
      visibleTonight: true,
      nextVisibleDate: tonight.date,
      nextVisibleNightInfo: tonight,
      visibility: tonightResult.visibility,
      neverVisible: false,
      neverVisibleReason: null,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: false,
      angularSizeArcmin: angularSize,
      azimuthAtPeak: tonightResult.visibility.azimuthAtPeak ?? null,
      canReachOptimal: isOptimalTonight || nextOptimalDate !== null,
      optimalAltitudeNote: optimalCheck.note,
      nextOptimalDate,
    };
  }

  // Find next visible night
  const nextVisible = await findNextVisibleNight(getRaDec, calculator, tonight.date);

  if (nextVisible) {
    const daysUntil = Math.round(
      (nextVisible.date.getTime() - tonight.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    const status: ObjectVisibilityStatus = daysUntil <= 30 ? 'visible_soon' : 'visible_later';

    // Check if optimal on that night
    const isOptimalThatNight = nextVisible.visibility.maxAltitude >= OPTIMAL_ALTITUDE;
    let nextOptimalDate: Date | null = isOptimalThatNight ? nextVisible.date : null;

    if (!isOptimalThatNight && optimalCheck.canReach) {
      const dayAfter = addAbsoluteDays(nextVisible.date, 1);
      const nextOptimal = await findNextOptimalNight(getRaDec, calculator, dayAfter);
      if (nextOptimal) {
        nextOptimalDate = nextOptimal.date;
      }
    }

    return {
      objectName: dso.name,
      displayName: dso.commonName || dso.name,
      objectType: 'dso',
      subtype: dso.type,
      raHours: dso.raHours,
      decDegrees: dso.decDegrees,
      magnitude: dso.magnitude,
      constellation: dso.constellation || null,
      messierNumber: dso.messierNumber,
      visibilityStatus: status,
      visibleTonight: false,
      nextVisibleDate: nextVisible.date,
      nextVisibleNightInfo: nextVisible.nightInfo,
      visibility: nextVisible.visibility,
      neverVisible: false,
      neverVisibleReason: null,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: false,
      angularSizeArcmin: angularSize,
      azimuthAtPeak: nextVisible.visibility.azimuthAtPeak ?? null,
      canReachOptimal: nextOptimalDate !== null,
      optimalAltitudeNote: optimalCheck.note,
      nextOptimalDate,
    };
  }

  // Not visible within search period (likely seasonal)
  return {
    objectName: dso.name,
    displayName: dso.commonName || dso.name,
    objectType: 'dso',
    subtype: dso.type,
    raHours: dso.raHours,
    decDegrees: dso.decDegrees,
    magnitude: dso.magnitude,
    constellation: dso.constellation || null,
    messierNumber: dso.messierNumber,
    visibilityStatus: 'below_horizon',
    visibleTonight: false,
    nextVisibleDate: null,
    nextVisibleNightInfo: null,
    visibility: null,
    neverVisible: false,
    neverVisibleReason: 'Object not visible at night within the next year',
    maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
    isMovingObject: false,
    angularSizeArcmin: angularSize,
    azimuthAtPeak: null,
    canReachOptimal: optimalCheck.canReach,
    optimalAltitudeNote: optimalCheck.note,
    nextOptimalDate: null,
  };
}

/**
 * Create a search result for a planet
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Astronomical search requires handling multiple visibility scenarios
async function createPlanetSearchResult(
  planetName: string,
  calculator: SkyCalculator,
  tonight: NightInfo
): Promise<ObjectSearchResult> {
  const observer = new Astronomy.Observer(
    calculator.getLatitude(),
    calculator.getLongitude(),
    calculator.getElevation()
  );

  const currentPos = getPlanetPosition(planetName, tonight.date, observer);

  const hemisphereCheck = canObjectEverBeVisible(currentPos.dec, calculator.getLatitude());
  const optimalCheck = canObjectReachOptimal(currentPos.dec, calculator.getLatitude());

  // Planets move, so we need a different approach
  const getRaDec = (time: Date) => {
    const pos = getPlanetPosition(planetName, time, observer);
    return { ra: pos.ra, dec: pos.dec };
  };

  // Check tonight
  const tonightPos = getRaDec(tonight.date);
  const tonightResult = checkVisibilityForNight(
    tonightPos.ra,
    tonightPos.dec,
    calculator,
    tonight,
    MIN_ALTITUDE,
    getRaDec
  );

  if (tonightResult.isVisible && tonightResult.visibility) {
    // Calculate planet visibility with proper method
    const visibility = calculator.calculatePlanetVisibility(planetName, tonight);
    const isOptimalTonight = visibility.maxAltitude >= OPTIMAL_ALTITUDE;
    let nextOptimalDate: Date | null = null;
    let optimalNote = optimalCheck.note;

    if (!isOptimalTonight) {
      const tomorrow = addAbsoluteDays(tonight.date, 1);
      const nextOptimal = await findNextOptimalNight(getRaDec, calculator, tomorrow);
      if (nextOptimal) {
        nextOptimalDate = nextOptimal.date;
      } else {
        optimalNote = `Best tonight: ${visibility.maxAltitude.toFixed(0)}° (optimal is ${OPTIMAL_ALTITUDE}°+)`;
      }
    }

    return {
      objectName: planetName,
      displayName: planetName,
      objectType: 'planet',
      subtype: null,
      raHours: visibility.raHours,
      decDegrees: visibility.decDegrees,
      magnitude: visibility.magnitude,
      constellation: null,
      messierNumber: null,
      visibilityStatus: 'visible_tonight',
      visibleTonight: true,
      nextVisibleDate: tonight.date,
      nextVisibleNightInfo: tonight,
      visibility,
      neverVisible: false,
      neverVisibleReason: null,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: true,
      angularSizeArcmin: null,
      azimuthAtPeak: visibility.azimuthAtPeak ?? null,
      canReachOptimal: isOptimalTonight || nextOptimalDate !== null,
      optimalAltitudeNote: optimalNote,
      nextOptimalDate,
    };
  }

  // Find next visible night
  const nextVisible = await findNextVisibleNight(getRaDec, calculator, tonight.date);

  if (nextVisible) {
    const daysUntil = Math.round(
      (nextVisible.date.getTime() - tonight.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    const status: ObjectVisibilityStatus = daysUntil <= 30 ? 'visible_soon' : 'visible_later';

    const visibility = calculator.calculatePlanetVisibility(planetName, nextVisible.nightInfo);
    const isOptimalThatNight = visibility.maxAltitude >= OPTIMAL_ALTITUDE;
    let nextOptimalDate: Date | null = isOptimalThatNight ? nextVisible.date : null;

    if (!isOptimalThatNight) {
      const dayAfter = addAbsoluteDays(nextVisible.date, 1);
      const nextOptimal = await findNextOptimalNight(getRaDec, calculator, dayAfter);
      if (nextOptimal) {
        nextOptimalDate = nextOptimal.date;
      }
    }

    return {
      objectName: planetName,
      displayName: planetName,
      objectType: 'planet',
      subtype: null,
      raHours: visibility.raHours,
      decDegrees: visibility.decDegrees,
      magnitude: visibility.magnitude,
      constellation: null,
      messierNumber: null,
      visibilityStatus: status,
      visibleTonight: false,
      nextVisibleDate: nextVisible.date,
      nextVisibleNightInfo: nextVisible.nightInfo,
      visibility,
      neverVisible: false,
      neverVisibleReason: null,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: true,
      angularSizeArcmin: null,
      azimuthAtPeak: visibility.azimuthAtPeak ?? null,
      canReachOptimal: nextOptimalDate !== null,
      optimalAltitudeNote: optimalCheck.note,
      nextOptimalDate,
    };
  }

  return {
    objectName: planetName,
    displayName: planetName,
    objectType: 'planet',
    subtype: null,
    raHours: tonightPos.ra,
    decDegrees: tonightPos.dec,
    magnitude: null,
    constellation: null,
    messierNumber: null,
    visibilityStatus: 'below_horizon',
    visibleTonight: false,
    nextVisibleDate: null,
    nextVisibleNightInfo: null,
    visibility: null,
    neverVisible: false,
    neverVisibleReason: 'Planet not visible at night within the next year',
    maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
    isMovingObject: true,
    angularSizeArcmin: null,
    azimuthAtPeak: null,
    canReachOptimal: false,
    optimalAltitudeNote: 'Not visible within search period',
    nextOptimalDate: null,
  };
}

/**
 * Create a search result for a comet
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Astronomical search requires handling multiple visibility scenarios
async function createCometSearchResult(
  comet: ParsedComet,
  calculator: SkyCalculator,
  tonight: NightInfo
): Promise<ObjectSearchResult> {
  const getRaDec = (time: Date) => {
    const pos = getCometPosition(comet, time);
    return pos ? { ra: pos.ra, dec: pos.dec } : null;
  };

  const tonightPos = getCometPosition(comet, tonight.date);
  if (!tonightPos) {
    return {
      objectName: comet.designation,
      displayName: `${comet.name} (${comet.designation})`,
      objectType: 'comet',
      subtype: null,
      raHours: 0,
      decDegrees: 0,
      magnitude: null,
      constellation: null,
      messierNumber: null,
      visibilityStatus: 'never_visible',
      visibleTonight: false,
      nextVisibleDate: null,
      nextVisibleNightInfo: null,
      visibility: null,
      neverVisible: true,
      neverVisibleReason: 'Unable to calculate comet position',
      maxPossibleAltitude: 0,
      isMovingObject: true,
      angularSizeArcmin: null,
      azimuthAtPeak: null,
      canReachOptimal: false,
      optimalAltitudeNote: 'Unable to calculate',
      nextOptimalDate: null,
    };
  }

  const hemisphereCheck = canObjectEverBeVisible(tonightPos.dec, calculator.getLatitude());
  const optimalCheck = canObjectReachOptimal(tonightPos.dec, calculator.getLatitude());

  // Check tonight
  const tonightResult = checkVisibilityForNight(
    tonightPos.ra,
    tonightPos.dec,
    calculator,
    tonight,
    MIN_ALTITUDE,
    getRaDec
  );

  if (tonightResult.isVisible && tonightResult.visibility) {
    const peakPos =
      getCometPosition(comet, tonightResult.visibility.maxAltitudeTime ?? tonight.date) ??
      tonightPos;
    tonightResult.visibility.magnitude = peakPos.magnitude;
    tonightResult.visibility.isInterstellar = comet.isInterstellar;

    const isOptimalTonight = tonightResult.visibility.maxAltitude >= OPTIMAL_ALTITUDE;
    let nextOptimalDate: Date | null = null;
    let optimalNote = optimalCheck.note;

    if (!isOptimalTonight) {
      const tomorrow = addAbsoluteDays(tonight.date, 1);
      const nextOptimal = await findNextOptimalNight(getRaDec, calculator, tomorrow);
      if (nextOptimal) {
        nextOptimalDate = nextOptimal.date;
      } else if (!optimalCheck.canReach) {
        optimalNote = `Best tonight: ${tonightResult.visibility.maxAltitude.toFixed(0)}° (optimal is ${OPTIMAL_ALTITUDE}°+)`;
      }
    }

    return {
      objectName: comet.designation,
      displayName: `${comet.name} (${comet.designation})`,
      objectType: 'comet',
      subtype: null,
      raHours: peakPos.ra,
      decDegrees: peakPos.dec,
      magnitude: peakPos.magnitude,
      constellation: null,
      messierNumber: null,
      visibilityStatus: 'visible_tonight',
      visibleTonight: true,
      nextVisibleDate: tonight.date,
      nextVisibleNightInfo: tonight,
      visibility: tonightResult.visibility,
      neverVisible: false,
      neverVisibleReason: null,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: true,
      angularSizeArcmin: null,
      azimuthAtPeak: tonightResult.visibility.azimuthAtPeak ?? null,
      canReachOptimal: isOptimalTonight || nextOptimalDate !== null,
      optimalAltitudeNote: optimalNote,
      nextOptimalDate,
    };
  }

  // Find next visible night
  const nextVisible = await findNextVisibleNight(getRaDec, calculator, tonight.date);

  if (nextVisible) {
    const daysUntil = Math.round(
      (nextVisible.date.getTime() - tonight.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    const status: ObjectVisibilityStatus = daysUntil <= 30 ? 'visible_soon' : 'visible_later';
    const peakPos =
      getCometPosition(
        comet,
        nextVisible.visibility.maxAltitudeTime ?? nextVisible.nightInfo.date
      ) ?? tonightPos;
    nextVisible.visibility.magnitude = peakPos.magnitude;
    nextVisible.visibility.isInterstellar = comet.isInterstellar;

    const isOptimalThatNight = nextVisible.visibility.maxAltitude >= OPTIMAL_ALTITUDE;
    let nextOptimalDate: Date | null = isOptimalThatNight ? nextVisible.date : null;

    if (!isOptimalThatNight) {
      const dayAfter = addAbsoluteDays(nextVisible.date, 1);
      const nextOptimal = await findNextOptimalNight(getRaDec, calculator, dayAfter);
      if (nextOptimal) {
        nextOptimalDate = nextOptimal.date;
      }
    }

    return {
      objectName: comet.designation,
      displayName: `${comet.name} (${comet.designation})`,
      objectType: 'comet',
      subtype: null,
      raHours: peakPos.ra,
      decDegrees: peakPos.dec,
      magnitude: peakPos.magnitude,
      constellation: null,
      messierNumber: null,
      visibilityStatus: status,
      visibleTonight: false,
      nextVisibleDate: nextVisible.date,
      nextVisibleNightInfo: nextVisible.nightInfo,
      visibility: nextVisible.visibility,
      neverVisible: false,
      neverVisibleReason: null,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: true,
      angularSizeArcmin: null,
      azimuthAtPeak: nextVisible.visibility.azimuthAtPeak ?? null,
      canReachOptimal: nextOptimalDate !== null,
      optimalAltitudeNote: optimalCheck.note,
      nextOptimalDate,
    };
  }

  return {
    objectName: comet.designation,
    displayName: `${comet.name} (${comet.designation})`,
    objectType: 'comet',
    subtype: null,
    raHours: tonightPos.ra,
    decDegrees: tonightPos.dec,
    magnitude: tonightPos.magnitude,
    constellation: null,
    messierNumber: null,
    visibilityStatus: 'below_horizon',
    visibleTonight: false,
    nextVisibleDate: null,
    nextVisibleNightInfo: null,
    visibility: null,
    neverVisible: false,
    neverVisibleReason: 'Comet not visible at night within the next year',
    maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
    isMovingObject: true,
    angularSizeArcmin: null,
    azimuthAtPeak: null,
    canReachOptimal: false,
    optimalAltitudeNote: 'Not visible within search period',
    nextOptimalDate: null,
  };
}

/**
 * Create a search result for a minor planet (dwarf planet or asteroid)
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Astronomical search requires handling multiple visibility scenarios
async function createMinorPlanetSearchResult(
  mp: MinorPlanetData,
  calculator: SkyCalculator,
  tonight: NightInfo
): Promise<ObjectSearchResult> {
  const objectType: ObjectCategory = mp.category === 'dwarf_planet' ? 'dwarf_planet' : 'asteroid';

  const getRaDec = (time: Date) => {
    const pos = getMinorPlanetPosition(mp, time);
    return pos ? { ra: pos.ra, dec: pos.dec } : null;
  };

  const tonightPos = getMinorPlanetPosition(mp, tonight.date);
  if (!tonightPos) {
    return {
      objectName: mp.name,
      displayName: mp.name,
      objectType,
      subtype: null,
      raHours: 0,
      decDegrees: 0,
      magnitude: null,
      constellation: null,
      messierNumber: null,
      visibilityStatus: 'never_visible',
      visibleTonight: false,
      nextVisibleDate: null,
      nextVisibleNightInfo: null,
      visibility: null,
      neverVisible: true,
      neverVisibleReason: 'Unable to calculate position',
      maxPossibleAltitude: 0,
      isMovingObject: true,
      angularSizeArcmin: null,
      azimuthAtPeak: null,
      canReachOptimal: false,
      optimalAltitudeNote: 'Unable to calculate',
      nextOptimalDate: null,
    };
  }

  const hemisphereCheck = canObjectEverBeVisible(tonightPos.dec, calculator.getLatitude());
  const optimalCheck = canObjectReachOptimal(tonightPos.dec, calculator.getLatitude());

  // Check tonight
  const tonightResult = checkVisibilityForNight(
    tonightPos.ra,
    tonightPos.dec,
    calculator,
    tonight,
    MIN_ALTITUDE,
    getRaDec
  );

  if (tonightResult.isVisible && tonightResult.visibility) {
    const peakPos =
      getMinorPlanetPosition(mp, tonightResult.visibility.maxAltitudeTime ?? tonight.date) ??
      tonightPos;
    tonightResult.visibility.magnitude = peakPos.magnitude;

    const isOptimalTonight = tonightResult.visibility.maxAltitude >= OPTIMAL_ALTITUDE;
    let nextOptimalDate: Date | null = null;
    let optimalNote = optimalCheck.note;

    if (!isOptimalTonight) {
      const tomorrow = addAbsoluteDays(tonight.date, 1);
      const nextOptimal = await findNextOptimalNight(getRaDec, calculator, tomorrow);
      if (nextOptimal) {
        nextOptimalDate = nextOptimal.date;
      } else if (!optimalCheck.canReach) {
        optimalNote = `Best tonight: ${tonightResult.visibility.maxAltitude.toFixed(0)}° (optimal is ${OPTIMAL_ALTITUDE}°+)`;
      }
    }

    return {
      objectName: mp.name,
      displayName: mp.name,
      objectType,
      subtype: null,
      raHours: peakPos.ra,
      decDegrees: peakPos.dec,
      magnitude: peakPos.magnitude,
      constellation: null,
      messierNumber: null,
      visibilityStatus: 'visible_tonight',
      visibleTonight: true,
      nextVisibleDate: tonight.date,
      nextVisibleNightInfo: tonight,
      visibility: tonightResult.visibility,
      neverVisible: false,
      neverVisibleReason: null,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: true,
      angularSizeArcmin: null,
      azimuthAtPeak: tonightResult.visibility.azimuthAtPeak ?? null,
      canReachOptimal: isOptimalTonight || nextOptimalDate !== null,
      optimalAltitudeNote: optimalNote,
      nextOptimalDate,
    };
  }

  // Find next visible night
  const nextVisible = await findNextVisibleNight(getRaDec, calculator, tonight.date);

  if (nextVisible) {
    const daysUntil = Math.round(
      (nextVisible.date.getTime() - tonight.date.getTime()) / (1000 * 60 * 60 * 24)
    );
    const status: ObjectVisibilityStatus = daysUntil <= 30 ? 'visible_soon' : 'visible_later';
    const peakPos =
      getMinorPlanetPosition(
        mp,
        nextVisible.visibility.maxAltitudeTime ?? nextVisible.nightInfo.date
      ) ?? tonightPos;
    nextVisible.visibility.magnitude = peakPos.magnitude;

    const isOptimalThatNight = nextVisible.visibility.maxAltitude >= OPTIMAL_ALTITUDE;
    let nextOptimalDate: Date | null = isOptimalThatNight ? nextVisible.date : null;

    if (!isOptimalThatNight) {
      const dayAfter = addAbsoluteDays(nextVisible.date, 1);
      const nextOptimal = await findNextOptimalNight(getRaDec, calculator, dayAfter);
      if (nextOptimal) {
        nextOptimalDate = nextOptimal.date;
      }
    }

    return {
      objectName: mp.name,
      displayName: mp.name,
      objectType,
      subtype: null,
      raHours: peakPos.ra,
      decDegrees: peakPos.dec,
      magnitude: peakPos.magnitude,
      constellation: null,
      messierNumber: null,
      visibilityStatus: status,
      visibleTonight: false,
      nextVisibleDate: nextVisible.date,
      nextVisibleNightInfo: nextVisible.nightInfo,
      visibility: nextVisible.visibility,
      neverVisible: false,
      neverVisibleReason: null,
      maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
      isMovingObject: true,
      angularSizeArcmin: null,
      azimuthAtPeak: nextVisible.visibility.azimuthAtPeak ?? null,
      canReachOptimal: nextOptimalDate !== null,
      optimalAltitudeNote: optimalCheck.note,
      nextOptimalDate,
    };
  }

  return {
    objectName: mp.name,
    displayName: mp.name,
    objectType,
    subtype: null,
    raHours: tonightPos.ra,
    decDegrees: tonightPos.dec,
    magnitude: tonightPos.magnitude,
    constellation: null,
    messierNumber: null,
    visibilityStatus: 'below_horizon',
    visibleTonight: false,
    nextVisibleDate: null,
    nextVisibleNightInfo: null,
    visibility: null,
    neverVisible: false,
    neverVisibleReason: 'Object not visible at night within the next year',
    maxPossibleAltitude: hemisphereCheck.maxPossibleAltitude,
    isMovingObject: true,
    angularSizeArcmin: null,
    azimuthAtPeak: null,
    canReachOptimal: false,
    optimalAltitudeNote: 'Not visible within search period',
    nextOptimalDate: null,
  };
}

/**
 * Main search function - searches all catalogs and returns visibility information
 */
export async function searchCelestialObjects(
  query: string,
  location: Location,
  maxResults: number = 20,
  progressCallback?: (message: string) => void,
  referenceDate: Date = new Date()
): Promise<ObjectSearchResult[]> {
  if (!query || query.trim().length < 1) {
    return [];
  }

  const results: ObjectSearchResult[] = [];

  // Initialize calculator
  const calculator = new SkyCalculator(location.latitude, location.longitude);
  const tonight = calculator.getNightInfo(getObserverNoon(referenceDate, location.timezone));

  // Search planets first (fast)
  progressCallback?.('Searching planets...');
  const matchingPlanets = searchPlanets(query);
  for (const planet of matchingPlanets) {
    const result = await createPlanetSearchResult(planet, calculator, tonight);
    results.push(result);
  }

  // Search dwarf planets (fast)
  progressCallback?.('Searching dwarf planets...');
  const matchingDwarfPlanets = searchDwarfPlanets(query);
  for (const dp of matchingDwarfPlanets) {
    const result = await createMinorPlanetSearchResult(dp, calculator, tonight);
    results.push(result);
  }

  // Search asteroids (fast)
  progressCallback?.('Searching asteroids...');
  const matchingAsteroids = searchAsteroids(query);
  for (const asteroid of matchingAsteroids) {
    const result = await createMinorPlanetSearchResult(asteroid, calculator, tonight);
    results.push(result);
  }

  // Search DSO catalog (may need loading)
  progressCallback?.('Searching deep sky objects...');
  try {
    const dsoCatalog = await loadOpenNGCCatalog({ maxMagnitude: 20 });
    const matchingDSOs = await searchDSOs(query, dsoCatalog);

    // Limit DSO results
    const limitedDSOs = matchingDSOs.slice(0, maxResults - results.length);

    for (const dso of limitedDSOs) {
      const result = await createDSOSearchResult(dso, calculator, tonight);
      results.push(result);
    }
  } catch (_error) {
    // Silently fail - user can still see other search results
  }

  // Search comets (may need fetching)
  progressCallback?.('Searching comets...');
  try {
    const comets = await fetchComets(20);
    const matchingComets = searchComets(query, comets);

    for (const comet of matchingComets.slice(0, 5)) {
      const result = await createCometSearchResult(comet, calculator, tonight);
      results.push(result);
    }
  } catch (_error) {
    // Silently fail - user can still see other search results
  }

  // Sort results: visible tonight first, then by visibility status
  const statusOrder: Record<ObjectVisibilityStatus, number> = {
    visible_tonight: 0,
    visible_soon: 1,
    visible_later: 2,
    below_horizon: 3,
    never_visible: 4,
  };

  results.sort((a, b) => statusOrder[a.visibilityStatus] - statusOrder[b.visibilityStatus]);

  return results.slice(0, maxResults);
}
