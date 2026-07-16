import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { SkyCalculator } from '../astronomy/calculator';
import { findFirstMatchingDay, getObserverNoon, getPlanetPosition } from './search-astronomy';

describe('object-search observer date anchoring', () => {
  it('uses the observing location civil date instead of the device civil date', () => {
    const instant = new Date('2026-07-16T02:00:00.000Z');

    expect(getObserverNoon(instant, 'Asia/Tokyo').toISOString()).toBe('2026-07-16T03:00:00.000Z');
    expect(getObserverNoon(instant, 'America/Los_Angeles').toISOString()).toBe(
      '2026-07-15T19:00:00.000Z'
    );
  });

  it('respects the observer timezone offset on both sides of a DST change', () => {
    expect(
      getObserverNoon(new Date('2026-03-28T23:30:00.000Z'), 'Europe/London').toISOString()
    ).toBe('2026-03-28T12:00:00.000Z');
    expect(
      getObserverNoon(new Date('2026-03-29T22:30:00.000Z'), 'Europe/London').toISOString()
    ).toBe('2026-03-29T11:00:00.000Z');
  });
});

describe('object-search coordinate frames', () => {
  it('supplies J2000 planetary coordinates to the J2000 visibility calculator', () => {
    const time = new Date('2050-07-16T23:00:00.000Z');
    const observer = new Astronomy.Observer(51.5074, -0.1278, 0);
    const calculator = new SkyCalculator(51.5074, -0.1278);

    const j2000 = getPlanetPosition('Jupiter', time, observer);
    const throughCalculator = calculator.getAltAz(j2000.ra, j2000.dec, time);
    const ofDate = Astronomy.Equator(Astronomy.Body.Jupiter, time, observer, true, true);
    const direct = Astronomy.Horizon(time, observer, ofDate.ra, ofDate.dec, 'normal');

    expect(throughCalculator.altitude).toBeCloseTo(direct.altitude, 9);
    expect(throughCalculator.azimuth).toBeCloseTo(direct.azimuth, 9);

    const doublePrecessed = calculator.getAltAz(ofDate.ra, ofDate.dec, time);
    expect(Math.abs(doublePrecessed.altitude - direct.altitude)).toBeGreaterThan(0.01);
  });

  it('rejects an unknown planet instead of returning invalid coordinates', () => {
    const observer = new Astronomy.Observer(0, 0, 0);
    expect(() => getPlanetPosition('Earth', new Date('2026-01-01T00:00:00Z'), observer)).toThrow(
      'Unknown planet: Earth'
    );
  });
});

describe('object-search future visibility', () => {
  it('does not skip a short non-monotonic window between sparse probe dates', async () => {
    const start = new Date('2026-01-01T12:00:00.000Z');
    const target = new Date('2026-01-04T12:00:00.000Z');

    const result = await findFirstMatchingDay(start, 7, date =>
      date.getTime() === target.getTime() ? date : null
    );

    expect(result?.toISOString()).toBe('2026-01-04T12:00:00.000Z');
  });

  it('returns null when no day in the inclusive search range matches', async () => {
    const result = await findFirstMatchingDay(new Date('2026-01-01T12:00:00Z'), 2, () => null);
    expect(result).toBeNull();
  });
});
