import * as Astronomy from 'astronomy-engine';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const DAY_MS = 86_400_000;

/** Anchor a search to noon on the observer's current civil date. */
export function getObserverNoon(referenceDate: Date, timezone?: string): Date {
  const observerTimezone = timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localReference = toZonedTime(referenceDate, observerTimezone);
  localReference.setHours(12, 0, 0, 0);
  return fromZonedTime(localReference, observerTimezone);
}

/** Advance by astronomical 24-hour days without applying the device's DST rules. */
export function addAbsoluteDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Return an apparent topocentric planet position in the J2000 equatorial frame. */
export function getPlanetPosition(
  planetName: string,
  time: Date,
  observer: Astronomy.Observer
): { ra: number; dec: number } {
  const bodyMap: Record<string, Astronomy.Body> = {
    mercury: Astronomy.Body.Mercury,
    venus: Astronomy.Body.Venus,
    mars: Astronomy.Body.Mars,
    jupiter: Astronomy.Body.Jupiter,
    saturn: Astronomy.Body.Saturn,
    uranus: Astronomy.Body.Uranus,
    neptune: Astronomy.Body.Neptune,
  };

  const body = bodyMap[planetName.toLowerCase()];
  if (!body) throw new Error(`Unknown planet: ${planetName}`);

  // SkyCalculator owns the J2000-to-date rotation. Returning equator-of-date
  // here would apply precession twice.
  const equator = Astronomy.Equator(body, time, observer, false, true);
  return { ra: equator.ra, dec: equator.dec };
}

/**
 * Evaluate every day until a match is found.
 *
 * Astronomy visibility is not monotonic for moving bodies, polar darkness,
 * or short seasonal windows, so exponential/binary probing is unsafe.
 */
export async function findFirstMatchingDay<T>(
  startDate: Date,
  maxDays: number,
  evaluate: (date: Date) => T | null | Promise<T | null>
): Promise<T | null> {
  for (let dayOffset = 0; dayOffset <= maxDays; dayOffset++) {
    if (dayOffset > 0 && dayOffset % 30 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const match = await evaluate(addAbsoluteDays(startDate, dayOffset));
    if (match !== null) return match;
  }

  return null;
}
