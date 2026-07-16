import * as Astronomy from 'astronomy-engine';
import type { OppositionEvent } from '@/types';

// Outer planets that can be at opposition
const OUTER_PLANETS: Array<{ name: string; body: Astronomy.Body }> = [
  { name: 'Mars', body: Astronomy.Body.Mars },
  { name: 'Jupiter', body: Astronomy.Body.Jupiter },
  { name: 'Saturn', body: Astronomy.Body.Saturn },
  { name: 'Uranus', body: Astronomy.Body.Uranus },
  { name: 'Neptune', body: Astronomy.Body.Neptune },
];

// How many days before/after opposition to consider it "active"
const OPPOSITION_WINDOW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Search for the next opposition of a planet after a given date
 * Opposition occurs when the planet's ecliptic longitude differs from
 * the Sun's by 180 degrees (planet is opposite the Sun in the sky)
 */
function searchNextOpposition(body: Astronomy.Body, startDate: Date): Date | null {
  try {
    // SearchRelativeLongitude finds when the planet reaches
    // a specific longitude difference from the Sun
    // Astronomy Engine defines relative longitude from the planet's
    // heliocentric viewpoint: 0 degrees is opposition for superior planets,
    // while 180 degrees is conjunction.
    const result = Astronomy.SearchRelativeLongitude(body, 0, startDate);
    return result?.date ?? null;
  } catch (_error) {
    return null;
  }
}

/**
 * Check if a planet is currently at or near opposition
 */
function isNearOpposition(
  body: Astronomy.Body,
  date: Date,
  windowDays: number = OPPOSITION_WINDOW_DAYS
): { isActive: boolean; daysUntil: number; oppositionDate: Date | null } {
  try {
    // Search backwards to find if we're past a recent opposition
    const pastSearchDate = new Date(date.getTime() - (windowDays + 5) * DAY_MS);
    const pastOpposition = searchNextOpposition(body, pastSearchDate);

    if (pastOpposition) {
      const daysDiff = (date.getTime() - pastOpposition.getTime()) / (1000 * 60 * 60 * 24);

      // If we're within the window after opposition
      if (daysDiff >= 0 && daysDiff <= windowDays) {
        return {
          isActive: true,
          daysUntil: -Math.round(daysDiff), // negative = days past
          oppositionDate: pastOpposition,
        };
      }
    }

    // Search forward for next opposition
    const nextOpposition = searchNextOpposition(body, date);
    if (nextOpposition) {
      const daysUntil = (nextOpposition.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

      return {
        isActive: daysUntil <= windowDays,
        daysUntil: Math.round(daysUntil),
        oppositionDate: nextOpposition,
      };
    }

    return { isActive: false, daysUntil: Infinity, oppositionDate: null };
  } catch (_error) {
    return { isActive: false, daysUntil: Infinity, oppositionDate: null };
  }
}

/**
 * Detect all upcoming oppositions within the forecast window
 */
export function detectOppositions(date: Date, forecastDays: number = 7): OppositionEvent[] {
  const events: OppositionEvent[] = [];

  for (const planet of OUTER_PLANETS) {
    const { isActive, daysUntil, oppositionDate } = isNearOpposition(planet.body, date);

    // Include if opposition is within our extended window
    if (oppositionDate && Math.abs(daysUntil) <= forecastDays + OPPOSITION_WINDOW_DAYS) {
      events.push({
        planet: planet.name,
        date: oppositionDate,
        daysUntil,
        isActive,
      });
    }
  }

  // Sort by days until (active ones first, then upcoming)
  return events.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return Math.abs(a.daysUntil) - Math.abs(b.daysUntil);
  });
}

/**
 * Get opposition info for a specific planet name
 */
export function getOppositionForPlanet(planetName: string, date: Date): OppositionEvent | null {
  const planet = OUTER_PLANETS.find(p => p.name.toLowerCase() === planetName.toLowerCase());

  if (!planet) return null;

  const { isActive, daysUntil, oppositionDate } = isNearOpposition(planet.body, date);

  if (!oppositionDate) return null;

  return {
    planet: planet.name,
    date: oppositionDate,
    daysUntil,
    isActive,
  };
}
