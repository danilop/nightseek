import * as Astronomy from 'astronomy-engine';
import type { PlanetApsis } from '@/types';

/**
 * Average orbital distances (AU) for brightness boost calculation
 * These are semi-major axes
 */
const PLANET_MEAN_DISTANCES: Record<string, number> = {
  Mercury: 0.387,
  Venus: 0.723,
  Mars: 1.524,
  Jupiter: 5.203,
  Saturn: 9.537,
  Uranus: 19.191,
  Neptune: 30.069,
};

/**
 * Map planet names to astronomy-engine Body enum
 */
const PLANET_BODY_MAP: Record<string, Astronomy.Body> = {
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
};

/**
 * Days within which a planet is considered "near" perihelion/aphelion
 */
const APSIS_WINDOW_DAYS = 30;

/**
 * Calculate the brightness boost percentage when a planet is closer than average
 *
 * Brightness varies inversely with the square of distance, so:
 * boost = ((avgDist / currentDist)^2 - 1) * 100
 */
export function calculateBrightnessBoost(currentDistAU: number, avgDistAU: number): number {
  if (currentDistAU >= avgDistAU) {
    return 0; // No boost when farther than average
  }

  const ratio = avgDistAU / currentDistAU;
  const boost = (ratio * ratio - 1) * 100;

  return Math.round(boost);
}

/**
 * Search for the next perihelion or aphelion of a planet
 */
function searchNextApsis(body: Astronomy.Body, startDate: Date): Astronomy.Apsis | null {
  try {
    const apsis = Astronomy.SearchPlanetApsis(body, startDate);
    return apsis;
  } catch (_error) {
    return null;
  }
}

/**
 * Get the previous apsis event before a date
 */
function searchPreviousApsis(body: Astronomy.Body, date: Date): Astronomy.Apsis | null {
  // Search from 2 years before to find the previous apsis
  const searchStart = new Date(date);
  searchStart.setFullYear(searchStart.getFullYear() - 2);

  let lastApsis: Astronomy.Apsis | null = null;
  let currentApsis = searchNextApsis(body, searchStart);

  while (currentApsis && currentApsis.time.date.getTime() < date.getTime()) {
    lastApsis = currentApsis;
    currentApsis = Astronomy.NextPlanetApsis(body, currentApsis);
  }

  return lastApsis;
}

/**
 * Get planet apsis (perihelion/aphelion) information
 *
 * Returns info about whether the planet is near its perihelion or aphelion,
 * and calculates the brightness boost if applicable.
 */
export function getPlanetApsisInfo(planetName: string, date: Date): PlanetApsis | null {
  const body = PLANET_BODY_MAP[planetName];
  if (!body) {
    return null;
  }

  const avgDist = PLANET_MEAN_DISTANCES[planetName];
  if (!avgDist) {
    return null;
  }

  try {
    // Get the current heliocentric distance
    const helioVector = Astronomy.HelioVector(body, date);
    const currentDistAU = Math.sqrt(
      helioVector.x * helioVector.x + helioVector.y * helioVector.y + helioVector.z * helioVector.z
    );

    // Search for the nearest apsis (both previous and next)
    const previousApsis = searchPreviousApsis(body, date);
    const nextApsis = searchNextApsis(body, date);

    // Determine which is closer
    let nearestApsis: Astronomy.Apsis | null = null;
    let daysUntil = Infinity;

    if (previousApsis) {
      const daysSince =
        (date.getTime() - previousApsis.time.date.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSince <= APSIS_WINDOW_DAYS) {
        nearestApsis = previousApsis;
        daysUntil = -Math.round(daysSince);
      }
    }

    if (nextApsis) {
      const daysToNext = (nextApsis.time.date.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);
      if (daysToNext <= APSIS_WINDOW_DAYS && daysToNext < Math.abs(daysUntil)) {
        nearestApsis = nextApsis;
        daysUntil = Math.round(daysToNext);
      }
    }

    if (!nearestApsis) {
      // Not near any apsis
      return null;
    }

    // Determine if perihelion (kind=0) or aphelion (kind=1)
    const type: 'perihelion' | 'aphelion' = nearestApsis.kind === 0 ? 'perihelion' : 'aphelion';

    // Calculate brightness boost only for perihelion
    const brightnessBoost =
      type === 'perihelion' ? calculateBrightnessBoost(currentDistAU, avgDist) : 0;

    return {
      planet: planetName,
      type,
      date: nearestApsis.time.date,
      distanceAU: nearestApsis.dist_au,
      daysUntil: Math.abs(daysUntil),
      brightnessBoostPercent: brightnessBoost,
    };
  } catch (_error) {
    return null;
  }
}

/**
 * Check if a planet is near its perihelion
 */
export function isNearPerihelion(
  planetName: string,
  date: Date
): {
  isNear: boolean;
  daysUntil: number;
  brightnessBoostPercent: number;
} {
  const apsisInfo = getPlanetApsisInfo(planetName, date);

  if (!apsisInfo || apsisInfo.type !== 'perihelion') {
    return { isNear: false, daysUntil: Infinity, brightnessBoostPercent: 0 };
  }

  return {
    isNear: true,
    daysUntil: apsisInfo.daysUntil,
    brightnessBoostPercent: apsisInfo.brightnessBoostPercent,
  };
}

/**
 * Get all planets that are near perihelion on a given date
 */
export function getPlanetsNearPerihelion(date: Date): PlanetApsis[] {
  const planets = Object.keys(PLANET_BODY_MAP);
  const results: PlanetApsis[] = [];

  for (const planet of planets) {
    const apsisInfo = getPlanetApsisInfo(planet, date);
    if (apsisInfo && apsisInfo.type === 'perihelion') {
      results.push(apsisInfo);
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Get upcoming apsis events for all planets within a time window
 */
export function getUpcomingApsisEvents(startDate: Date, windowDays: number = 90): PlanetApsis[] {
  const planets = Object.keys(PLANET_BODY_MAP);
  const results: PlanetApsis[] = [];
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + windowDays);

  for (const planet of planets) {
    const body = PLANET_BODY_MAP[planet];
    const avgDist = PLANET_MEAN_DISTANCES[planet];

    try {
      let apsis = Astronomy.SearchPlanetApsis(body, startDate);

      while (apsis && apsis.time.date.getTime() <= endDate.getTime()) {
        const type: 'perihelion' | 'aphelion' = apsis.kind === 0 ? 'perihelion' : 'aphelion';
        const daysUntil = Math.round(
          (apsis.time.date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
        );

        const brightnessBoost =
          type === 'perihelion' ? calculateBrightnessBoost(apsis.dist_au, avgDist) : 0;

        results.push({
          planet,
          type,
          date: apsis.time.date,
          distanceAU: apsis.dist_au,
          daysUntil,
          brightnessBoostPercent: brightnessBoost,
        });

        apsis = Astronomy.NextPlanetApsis(body, apsis);
      }
    } catch {
      // Planet apsis search failed - continue without this planet's data
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Get descriptive text for a planet apsis event
 */
export function getPlanetApsisDescription(apsis: PlanetApsis): string {
  const eventType = apsis.type === 'perihelion' ? 'Perihelion' : 'Aphelion';

  if (apsis.daysUntil === 0) {
    if (apsis.type === 'perihelion' && apsis.brightnessBoostPercent > 0) {
      return `${apsis.planet} at ${eventType} today (+${apsis.brightnessBoostPercent}% brighter)`;
    }
    return `${apsis.planet} at ${eventType} today`;
  }

  const dayStr = apsis.daysUntil === 1 ? 'day' : 'days';

  if (apsis.type === 'perihelion' && apsis.brightnessBoostPercent > 0) {
    return `${apsis.planet} near ${eventType} (+${apsis.brightnessBoostPercent}% brighter)`;
  }

  return `${apsis.planet} ${eventType} in ${apsis.daysUntil} ${dayStr}`;
}
