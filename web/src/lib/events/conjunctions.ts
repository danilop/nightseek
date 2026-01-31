import * as Astronomy from 'astronomy-engine';
import type { Conjunction, ObjectVisibility, NightInfo } from '@/types';
import { angularSeparation } from '../astronomy/calculator';

const CONJUNCTION_THRESHOLD = 10; // degrees

/**
 * Get the astronomy-engine body for a planet name
 */
function getPlanetBody(name: string): Astronomy.Body | null {
  const bodyMap: Record<string, Astronomy.Body> = {
    Mercury: Astronomy.Body.Mercury,
    Venus: Astronomy.Body.Venus,
    Mars: Astronomy.Body.Mars,
    Jupiter: Astronomy.Body.Jupiter,
    Saturn: Astronomy.Body.Saturn,
    Uranus: Astronomy.Body.Uranus,
    Neptune: Astronomy.Body.Neptune,
  };
  return bodyMap[name] ?? null;
}

/**
 * Detect conjunctions between planets and between planets and the Moon
 */
export function detectConjunctions(
  observer: Astronomy.Observer,
  visiblePlanets: ObjectVisibility[],
  nightInfo: NightInfo
): Conjunction[] {
  const conjunctions: Conjunction[] = [];

  // Calculate at midnight
  const midnight = new Date(
    (nightInfo.astronomicalDusk.getTime() + nightInfo.astronomicalDawn.getTime()) / 2
  );

  // Filter to only visible planets (max altitude >= 15)
  const planets = visiblePlanets.filter(p => p.maxAltitude >= 15);

  // Get planet positions at midnight
  const positions: Map<string, { ra: number; dec: number }> = new Map();

  for (const planet of planets) {
    const body = getPlanetBody(planet.objectName);
    if (!body) continue;

    const equator = Astronomy.Equator(body, midnight, observer, true, true);
    positions.set(planet.objectName, {
      ra: equator.ra * 15, // Convert to degrees
      dec: equator.dec,
    });
  }

  // Check planet-planet conjunctions
  const planetNames = Array.from(positions.keys());
  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const name1 = planetNames[i];
      const name2 = planetNames[j];
      const pos1 = positions.get(name1)!;
      const pos2 = positions.get(name2)!;

      const separation = angularSeparation(pos1.ra, pos1.dec, pos2.ra, pos2.dec);

      if (separation < CONJUNCTION_THRESHOLD) {
        conjunctions.push({
          object1Name: name1,
          object2Name: name2,
          separationDegrees: separation,
          time: midnight,
          description: getConjunctionDescription(name1, name2, separation),
          isNotable: separation < 5,
        });
      }
    }
  }

  // Check planet-moon conjunctions
  const moonEquator = Astronomy.Equator(Astronomy.Body.Moon, midnight, observer, true, true);
  const moonRa = moonEquator.ra * 15;
  const moonDec = moonEquator.dec;

  for (const [name, pos] of positions) {
    const separation = angularSeparation(pos.ra, pos.dec, moonRa, moonDec);

    if (separation < CONJUNCTION_THRESHOLD) {
      conjunctions.push({
        object1Name: name,
        object2Name: 'Moon',
        separationDegrees: separation,
        time: midnight,
        description: getConjunctionDescription(name, 'Moon', separation),
        isNotable: separation < 5,
      });
    }
  }

  // Sort by separation (closest first)
  return conjunctions.sort((a, b) => a.separationDegrees - b.separationDegrees);
}

/**
 * Generate a human-readable description for a conjunction
 */
function getConjunctionDescription(
  object1: string,
  object2: string,
  separation: number
): string {
  const sepStr = separation.toFixed(1);

  if (separation < 2) {
    return `Close conjunction: ${object1} and ${object2} only ${sepStr} degrees apart!`;
  } else if (separation < 5) {
    return `${object1} near ${object2} (${sepStr} degrees)`;
  } else {
    return `${object1} and ${object2} within ${sepStr} degrees`;
  }
}

/**
 * Check if there's a notable conjunction (< 5 degrees)
 */
export function hasNotableConjunction(conjunctions: Conjunction[]): boolean {
  return conjunctions.some(c => c.isNotable);
}
