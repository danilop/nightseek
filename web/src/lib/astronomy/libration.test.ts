import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { createMockNightInfo } from '@/test/factories';
import { getLibrationForNight } from './libration';

describe('getLibrationForNight', () => {
  it('uses the observing-window midpoint independent of the device timezone', () => {
    const nightInfo = createMockNightInfo({
      astronomicalDusk: new Date('2026-08-12T20:30:00Z'),
      astronomicalDawn: new Date('2026-08-13T04:30:00Z'),
    });
    const midpoint = new Date('2026-08-13T00:30:00Z');
    const expected = Astronomy.Libration(midpoint);
    const actual = getLibrationForNight(nightInfo);

    expect(actual.longitudeDeg).toBeCloseTo(expected.elon, 12);
    expect(actual.latitudeDeg).toBeCloseTo(expected.elat, 12);
  });
});
