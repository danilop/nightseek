import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { detectEclipses } from './eclipses';

describe('local eclipse visibility', () => {
  const searchDate = new Date('2026-03-02T00:00:00Z');

  it('does not report a lunar eclipse below the local horizon as visible', () => {
    const london = new Astronomy.Observer(51.5074, -0.1278, 0);
    const result = detectEclipses(searchDate, london, 2);

    expect(result.lunar?.peakTime.getTime()).toBeCloseTo(
      new Date('2026-03-03T11:33:40Z').getTime(),
      -4
    );
    expect(result.lunar?.isVisible).toBe(false);
    expect(result.lunar?.visibleKind).toBeNull();
    expect(result.lunar?.maxAltitude).toBeLessThan(0);
    expect(result.lunar?.obscuration).toBe(1);
  });

  it('reports the same eclipse visible where the Moon is above the horizon', () => {
    const sydney = new Astronomy.Observer(-33.8688, 151.2093, 0);
    const result = detectEclipses(searchDate, sydney, 2);

    expect(result.lunar?.isVisible).toBe(true);
    expect(result.lunar?.visibleKind).toBe('total');
    expect(result.lunar?.maxAltitude).toBeGreaterThan(30);
  });
});

describe('local solar eclipse circumstances', () => {
  const searchDate = new Date('2026-08-12T00:00:00Z');

  it('reports London contact times and local maximum coverage', () => {
    const london = new Astronomy.Observer(51.5074, -0.1278, 0);
    const eclipse = detectEclipses(searchDate, london, 1).solar;

    expect(eclipse?.kind).toBe('partial');
    expect(eclipse?.partialStart.getTime()).toBeCloseTo(
      new Date('2026-08-12T17:17:12Z').getTime(),
      -3
    );
    expect(eclipse?.peakTime.getTime()).toBeCloseTo(new Date('2026-08-12T18:13:12Z').getTime(), -3);
    expect(eclipse?.partialEnd.getTime()).toBeCloseTo(
      new Date('2026-08-12T19:06:11Z').getTime(),
      -3
    );
    expect(eclipse?.obscuration).toBeCloseTo(0.91326, 4);
    expect(eclipse?.altitude).toBeCloseTo(10.44, 1);
  });

  it('reports a central phase only where it is locally visible', () => {
    const reykjavik = new Astronomy.Observer(64.1466, -21.9426, 0);
    const eclipse = detectEclipses(searchDate, reykjavik, 1).solar;

    expect(eclipse?.kind).toBe('total');
    expect(eclipse?.obscuration).toBe(1);
    expect(eclipse?.centralStart).toBeInstanceOf(Date);
    expect(eclipse?.centralEnd).toBeInstanceOf(Date);
    expect(eclipse?.visibleStart.getTime()).toBe(eclipse?.partialStart.getTime());
    expect(eclipse?.visibleEnd.getTime()).toBe(eclipse?.partialEnd.getTime());
  });

  it('uses the maximum that is actually above the horizon when geometric peak is after sunset', () => {
    const nearSunset = new Astronomy.Observer(1, -15, 0);
    const eclipse = detectEclipses(searchDate, nearSunset, 1).solar;

    expect(eclipse?.kind).toBe('partial');
    expect(eclipse?.geometricPeakAltitude).toBeLessThan(0);
    expect(eclipse?.peakTime.getTime()).toBeLessThan(eclipse?.geometricPeakTime.getTime() ?? 0);
    expect((eclipse?.visibleEnd.getTime() ?? 0) - (eclipse?.peakTime.getTime() ?? 0)).toBe(1_000);
    expect(eclipse?.altitude).toBeGreaterThanOrEqual(0);
    expect(eclipse?.obscuration).toBeGreaterThan(0);
    expect(eclipse?.obscuration).toBeLessThan(0.0669);
  });
});
