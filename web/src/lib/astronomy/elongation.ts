import * as Astronomy from 'astronomy-engine';
import type { MaxElongation } from '@/types';

// Inner planets - only Mercury and Venus show elongation
const INNER_PLANETS: Array<{ name: 'Mercury' | 'Venus'; body: Astronomy.Body }> = [
  { name: 'Mercury', body: Astronomy.Body.Mercury },
  { name: 'Venus', body: Astronomy.Body.Venus },
];

// Window for considering "at max elongation"
const ELONGATION_WINDOW_DAYS = 7;

/**
 * Get current elongation (angular separation from Sun) for a planet
 */
function getElongation(
  body: Astronomy.Body,
  date: Date
): { elongation: number; visibility: string } {
  try {
    const result = Astronomy.Elongation(body, date);
    return {
      elongation: result.elongation,
      visibility: result.visibility.toString(),
    };
  } catch (_error) {
    return { elongation: 0, visibility: 'unknown' };
  }
}

/**
 * Search for the next maximum elongation of Mercury or Venus
 */
function searchMaxElongation(
  body: Astronomy.Body,
  startDate: Date
): { date: Date; elongation: number; isEastern: boolean } | null {
  try {
    const result = Astronomy.SearchMaxElongation(body, startDate);
    if (!result) return null;

    return {
      date: result.time.date,
      elongation: result.elongation,
      // Evening visibility means the planet is east of the Sun
      isEastern: result.visibility.toString() === 'Evening',
    };
  } catch (_error) {
    return null;
  }
}

/**
 * Check if a planet is near its maximum elongation
 */
function isNearMaxElongation(
  body: Astronomy.Body,
  date: Date,
  windowDays: number = ELONGATION_WINDOW_DAYS
): {
  isNearMax: boolean;
  currentElongation: number;
  maxElongationDate: Date | null;
  maxElongation: number;
  isEastern: boolean;
  daysUntil: number;
} {
  try {
    // Get current elongation
    const current = getElongation(body, date);

    // Search backwards to find if we're past a recent max elongation
    const pastSearchDate = new Date(date);
    pastSearchDate.setDate(pastSearchDate.getDate() - windowDays - 5);
    const pastMax = searchMaxElongation(body, pastSearchDate);

    if (pastMax) {
      const daysDiff = (date.getTime() - pastMax.date.getTime()) / (1000 * 60 * 60 * 24);

      // If we're within the window after max elongation
      if (daysDiff >= 0 && daysDiff <= windowDays) {
        return {
          isNearMax: true,
          currentElongation: current.elongation,
          maxElongationDate: pastMax.date,
          maxElongation: pastMax.elongation,
          isEastern: pastMax.isEastern,
          daysUntil: -Math.round(daysDiff),
        };
      }
    }

    // Search forward for next max elongation
    const nextMax = searchMaxElongation(body, date);
    if (nextMax) {
      const daysUntil = (nextMax.date.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

      return {
        isNearMax: daysUntil <= windowDays,
        currentElongation: current.elongation,
        maxElongationDate: nextMax.date,
        maxElongation: nextMax.elongation,
        isEastern: nextMax.isEastern,
        daysUntil: Math.round(daysUntil),
      };
    }

    return {
      isNearMax: false,
      currentElongation: current.elongation,
      maxElongationDate: null,
      maxElongation: 0,
      isEastern: false,
      daysUntil: Infinity,
    };
  } catch (_error) {
    return {
      isNearMax: false,
      currentElongation: 0,
      maxElongationDate: null,
      maxElongation: 0,
      isEastern: false,
      daysUntil: Infinity,
    };
  }
}

/**
 * Detect upcoming max elongations for Mercury and Venus
 */
export function detectMaxElongations(date: Date, forecastDays: number = 7): MaxElongation[] {
  const events: MaxElongation[] = [];
  const windowDays = forecastDays + ELONGATION_WINDOW_DAYS;

  for (const planet of INNER_PLANETS) {
    const info = isNearMaxElongation(planet.body, date, windowDays);

    if (info.maxElongationDate && Math.abs(info.daysUntil) <= windowDays) {
      events.push({
        planet: planet.name,
        elongationDeg: info.maxElongation,
        isEastern: info.isEastern,
        date: info.maxElongationDate,
        daysUntil: info.daysUntil,
      });
    }
  }

  return events.sort((a, b) => Math.abs(a.daysUntil) - Math.abs(b.daysUntil));
}

/**
 * Get elongation info for a specific planet name
 */
export function getElongationForPlanet(
  planetName: string,
  date: Date
): { elongationDeg: number; isNearMax: boolean; isEastern: boolean } | null {
  const planet = INNER_PLANETS.find(p => p.name.toLowerCase() === planetName.toLowerCase());

  if (!planet) return null;

  const info = isNearMaxElongation(planet.body, date);

  return {
    elongationDeg: info.currentElongation,
    isNearMax: info.isNearMax,
    isEastern: info.isEastern,
  };
}

/**
 * Check if a planet is an inner planet (has elongation)
 */
export function isInnerPlanet(planetName: string): boolean {
  return INNER_PLANETS.some(p => p.name.toLowerCase() === planetName.toLowerCase());
}

/**
 * Check if a planet is an outer planet (can be at opposition)
 */
export function isOuterPlanet(planetName: string): boolean {
  const outerPlanets = ['mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  return outerPlanets.includes(planetName.toLowerCase());
}
