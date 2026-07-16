import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { createMockNightInfo } from '@/test/factories';
import type { LunarApsis } from '@/types';
import { describeLunarApsis, getLunarApsisForNight, isPerigeeFullMoon } from './lunar-apsis';

describe('perigee full moon classification', () => {
  it('uses exact phase-event timing instead of phase angle at perigee', () => {
    const fullMoon = Astronomy.SearchMoonPhase(180, new Date('2026-01-01T00:00:00Z'), 40);
    if (!fullMoon) throw new Error('Expected a full moon in the search interval');

    expect(isPerigeeFullMoon(new Date(fullMoon.date.getTime() + 23 * 3_600_000))).toBe(true);
    expect(isPerigeeFullMoon(new Date(fullMoon.date.getTime() + 25 * 3_600_000))).toBe(false);
  });

  it('returns the engine apsis when it falls in the requested window', () => {
    const expected = Astronomy.SearchLunarApsis(new Date('2026-01-01T00:00:00Z'));
    const night = createMockNightInfo({ date: expected.time.date });
    const result = getLunarApsisForNight(night, 1);

    expect(Math.abs((result?.date.getTime() ?? 0) - expected.time.date.getTime())).toBeLessThan(
      1000
    );
    expect(result?.distanceKm).toBeCloseTo(expected.dist_km, 6);
  });

  it('returns null when the next apsis is outside a zero-day window', () => {
    const night = createMockNightInfo({ date: new Date('2026-01-01T00:00:00Z') });
    expect(getLunarApsisForNight(night, 0)).toBeNull();
  });

  it.each([
    [{ type: 'perigee', distanceKm: 356_000, isSupermoon: true }, 'Perigee full moon'],
    [{ type: 'perigee', distanceKm: 363_000, isSupermoon: false }, 'appears'],
    [{ type: 'apogee', distanceKm: 405_000, isSupermoon: false }, 'smaller'],
  ] as const)('describes %s without overstating the geometry', (partial, expectedText) => {
    const apsis: LunarApsis = {
      ...partial,
      date: new Date('2026-01-01T00:00:00Z'),
    };
    expect(describeLunarApsis(apsis)).toContain(expectedText);
  });
});
