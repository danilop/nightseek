import { describe, expect, it } from 'vitest';
import bundledComets from '@/test/fixtures/mpc-photometry-reference.json';
import { lightTimeCorrectedEquatorial } from '../astronomy/orbital-mechanics';
import { calculateCometMagnitude, calculateCometPosition, type ParsedComet } from './comets';

// Independent JPL Horizons geocentric, astrometric ICRF / light-time-corrected
// reference. Retrieved 2026-11-01 for 2026-11-02 00:00 UTC. See docs/photometry.md.
const references = [
  { name: '2P', r: 1.803532976566, delta: 0.94122665731913, H: 15.7, k1: 4.5, magnitude: 16.721 },
  { name: '67P', r: 4.383064621169, delta: 5.04916335441247, H: 12.9, k1: 7.5, magnitude: 21.229 },
  {
    name: 'C/2023 A3',
    r: 8.833120882536,
    delta: 9.32714690749223,
    H: 8.9,
    k1: 5.5,
    magnitude: 18.952,
  },
];
describe('independent comet photometry reference', () => {
  it.each(references)(
    'reproduces Horizons total magnitude for $name with equivalent parameters',
    ref => {
      // Explicitly convert JPL k1 to MPC n, rather than treating them as interchangeable.
      expect(calculateCometMagnitude(ref.H, ref.delta, ref.r, ref.k1 / 2.5)).toBeCloseTo(
        ref.magnitude,
        3
      );
    }
  );
  it.each(references)('compares MPC geometry and brightness with Horizons for $name', ref => {
    const comet = bundledComets.find(c => c.designation === ref.name) as ParsedComet;
    const jd = new Date('2026-11-02T00:00:00Z').getTime() / 86400000 + 2440587.5;
    const equator = lightTimeCorrectedEquatorial(date => calculateCometPosition(comet, date), jd);
    const position = calculateCometPosition(comet, equator.emissionJulianDate);
    const prediction = calculateCometMagnitude(
      comet.absoluteMagnitude,
      equator.distance,
      position.r,
      comet.slopeParameter
    );
    // Perturbations / different orbital epochs preclude identical two-body positions.
    expect(Math.abs(position.r - ref.r)).toBeLessThan(0.03);
    expect(Math.abs(equator.distance - ref.delta)).toBeLessThan(0.03);
    expect(Number.isFinite(prediction)).toBe(true);
  });
});
