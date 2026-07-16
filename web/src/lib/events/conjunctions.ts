import * as Astronomy from 'astronomy-engine';
import type { Conjunction, NightInfo, ObjectVisibility } from '@/types';
import { angularSeparation } from '../astronomy/calculator';

const CONJUNCTION_THRESHOLD = 10;
const SAMPLE_STEP_MS = 10 * 60 * 1000;

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

function separationAt(
  body1: Astronomy.Body,
  body2: Astronomy.Body,
  observer: Astronomy.Observer,
  timeMs: number
): number {
  const time = new Date(timeMs);
  const first = Astronomy.Equator(body1, time, observer, true, true);
  const second = Astronomy.Equator(body2, time, observer, true, true);
  return angularSeparation(first.ra * 15, first.dec, second.ra * 15, second.dec);
}

function altitudeAt(body: Astronomy.Body, observer: Astronomy.Observer, time: Date): number {
  const equator = Astronomy.Equator(body, time, observer, true, true);
  return Astronomy.Horizon(time, observer, equator.ra, equator.dec, 'normal').altitude;
}

/** Numerically minimize true topocentric angular separation during the observing interval. */
export function findClosestApproach(
  body1: Astronomy.Body,
  body2: Astronomy.Body,
  observer: Astronomy.Observer,
  start: Date,
  end: Date
): { time: Date; separation: number } {
  const startMs = start.getTime();
  const endMs = end.getTime();
  let bestMs = startMs;
  let bestSeparation = separationAt(body1, body2, observer, startMs);

  for (let time = startMs + SAMPLE_STEP_MS; time <= endMs; time += SAMPLE_STEP_MS) {
    const separation = separationAt(body1, body2, observer, time);
    if (separation < bestSeparation) {
      bestSeparation = separation;
      bestMs = time;
    }
  }

  let low = Math.max(startMs, bestMs - SAMPLE_STEP_MS);
  let high = Math.min(endMs, bestMs + SAMPLE_STEP_MS);
  const ratio = (Math.sqrt(5) - 1) / 2;

  for (let iteration = 0; iteration < 32 && high - low > 1000; iteration++) {
    const left = high - ratio * (high - low);
    const right = low + ratio * (high - low);
    if (separationAt(body1, body2, observer, left) <= separationAt(body1, body2, observer, right)) {
      high = right;
    } else {
      low = left;
    }
  }

  const time = new Date((low + high) / 2);
  return { time, separation: separationAt(body1, body2, observer, time.getTime()) };
}

function buildConjunction(
  object1Name: string,
  object2Name: string,
  body1: Astronomy.Body,
  body2: Astronomy.Body,
  observer: Astronomy.Observer,
  nightInfo: NightInfo
): Conjunction | null {
  const closest = findClosestApproach(
    body1,
    body2,
    observer,
    nightInfo.observingWindowStart,
    nightInfo.observingWindowEnd
  );

  if (
    closest.separation >= CONJUNCTION_THRESHOLD ||
    altitudeAt(body1, observer, closest.time) <= 0 ||
    altitudeAt(body2, observer, closest.time) <= 0
  ) {
    return null;
  }

  return {
    object1Name,
    object2Name,
    separationDegrees: closest.separation,
    time: closest.time,
    description: getConjunctionDescription(object1Name, object2Name, closest.separation),
    isNotable: closest.separation < 5,
  };
}

export function detectConjunctions(
  observer: Astronomy.Observer,
  visiblePlanets: ObjectVisibility[],
  nightInfo: NightInfo
): Conjunction[] {
  if (nightInfo.observingWindowMode === 'none') return [];

  const planets = visiblePlanets
    .filter(planet => planet.maxAltitude >= 15)
    .map(planet => ({ name: planet.objectName, body: getPlanetBody(planet.objectName) }))
    .filter((planet): planet is { name: string; body: Astronomy.Body } => planet.body !== null);
  const conjunctions: Conjunction[] = [];

  for (let first = 0; first < planets.length; first++) {
    for (let second = first + 1; second < planets.length; second++) {
      const conjunction = buildConjunction(
        planets[first].name,
        planets[second].name,
        planets[first].body,
        planets[second].body,
        observer,
        nightInfo
      );
      if (conjunction) conjunctions.push(conjunction);
    }
  }

  for (const planet of planets) {
    const conjunction = buildConjunction(
      planet.name,
      'Moon',
      planet.body,
      Astronomy.Body.Moon,
      observer,
      nightInfo
    );
    if (conjunction) conjunctions.push(conjunction);
  }

  return conjunctions.sort((a, b) => a.separationDegrees - b.separationDegrees);
}

function getConjunctionDescription(object1: string, object2: string, separation: number): string {
  const sepStr = separation.toFixed(1);
  if (separation < 2) {
    return `Close conjunction: ${object1} and ${object2} only ${sepStr} degrees apart!`;
  }
  if (separation < 5) return `${object1} near ${object2} (${sepStr} degrees)`;
  return `${object1} and ${object2} within ${sepStr} degrees`;
}
