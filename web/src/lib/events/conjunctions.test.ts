import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import { angularSeparation } from '../astronomy/calculator';
import { findClosestApproach } from './conjunctions';

function separation(
  first: Astronomy.Body,
  second: Astronomy.Body,
  observer: Astronomy.Observer,
  time: Date
): number {
  const a = Astronomy.Equator(first, time, observer, true, true);
  const b = Astronomy.Equator(second, time, observer, true, true);
  return angularSeparation(a.ra * 15, a.dec, b.ra * 15, b.dec);
}

describe('closest approach', () => {
  it('returns a true local minimum of topocentric angular separation', () => {
    const observer = new Astronomy.Observer(51.5074, -0.1278, 0);
    const result = findClosestApproach(
      Astronomy.Body.Moon,
      Astronomy.Body.Jupiter,
      observer,
      new Date('2026-08-11T12:00:00Z'),
      new Date('2026-08-12T12:00:00Z')
    );
    const before = new Date(result.time.getTime() - 5 * 60 * 1000);
    const after = new Date(result.time.getTime() + 5 * 60 * 1000);

    expect(result.separation).toBeLessThanOrEqual(
      separation(Astronomy.Body.Moon, Astronomy.Body.Jupiter, observer, before)
    );
    expect(result.separation).toBeLessThanOrEqual(
      separation(Astronomy.Body.Moon, Astronomy.Body.Jupiter, observer, after)
    );
  });
});
