import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { getOppositionForPlanet } from './opposition';

describe('planetary opposition', () => {
  it('finds Jupiter opposite the Sun, not at conjunction', () => {
    const event = getOppositionForPlanet('Jupiter', new Date('2026-01-01T00:00:00Z'));

    expect(event).not.toBeNull();
    expect(event?.date.toISOString()).toBe('2026-01-10T08:29:31.660Z');
    expect(Astronomy.AngleFromSun(Astronomy.Body.Jupiter, event?.date as Date)).toBeGreaterThan(
      179
    );
  });
});
