import { describe, expect, it } from 'vitest';
import {
  getEarthPosition,
  heliocentricToEquatorial,
  meanMotion,
  orbitalToEcliptic,
  solveKepler,
} from './orbital-mechanics';

describe('orbital-mechanics', () => {
  describe('solveKepler', () => {
    it('should return 0 for circular orbit with M=0', () => {
      expect(solveKepler(0, 0)).toBe(0);
    });

    it('should return M for circular orbit (e=0)', () => {
      const M = 1.5;
      expect(solveKepler(M, 0)).toBeCloseTo(M, 10);
    });

    it('should converge for typical elliptical orbit', () => {
      const M = 0.5; // Mean anomaly in radians
      const e = 0.2;
      const E = solveKepler(M, e);
      // Verify: M = E - e*sin(E)
      const computed = E - e * Math.sin(E);
      expect(computed).toBeCloseTo(M, 10);
    });

    it('should converge for high eccentricity elliptical orbit', () => {
      const M = 2.0;
      const e = 0.95;
      const E = solveKepler(M, e);
      const computed = E - e * Math.sin(E);
      expect(computed).toBeCloseTo(M, 8);
    });

    it('should handle hyperbolic orbits (e > 1)', () => {
      const M = 1.0;
      const e = 1.5;
      const H = solveKepler(M, e);
      // Verify: M = e*sinh(H) - H
      const computed = e * Math.sinh(H) - H;
      expect(computed).toBeCloseTo(M, 8);
    });

    it('should respect custom tolerance', () => {
      const M = 0.5;
      const e = 0.3;
      const E1 = solveKepler(M, e, 50, 1e-10);
      const E2 = solveKepler(M, e, 50, 1e-12);
      // Both should be very close but may differ slightly
      expect(E1).toBeCloseTo(E2, 9);
    });
  });

  describe('getEarthPosition', () => {
    it('should return position near 1 AU from the Sun', () => {
      // J2000.0 epoch
      const jd = 2451545.0;
      const pos = getEarthPosition(jd);
      const r = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
      expect(r).toBeCloseTo(1.0, 1); // Within 0.1 AU
    });

    it('should have z approximately 0 (ecliptic plane)', () => {
      const jd = 2451545.0;
      const pos = getEarthPosition(jd);
      expect(pos.z).toBe(0);
    });

    it('should return different positions for different dates', () => {
      const pos1 = getEarthPosition(2451545.0);
      const pos2 = getEarthPosition(2451545.0 + 182.5); // ~6 months later
      // Should be roughly opposite sides of the Sun
      expect(pos1.x * pos2.x + pos1.y * pos2.y).toBeLessThan(0);
    });
  });

  describe('orbitalToEcliptic', () => {
    it('should return identity for zero angles', () => {
      const result = orbitalToEcliptic(1, 0, 0, 0, 0);
      expect(result.x).toBeCloseTo(1, 10);
      expect(result.y).toBeCloseTo(0, 10);
      expect(result.z).toBeCloseTo(0, 10);
    });

    it('should handle non-zero orbital coordinates', () => {
      const result = orbitalToEcliptic(1, 1, 0, 0, 0);
      // With zero angles, x_orbital and y_orbital map directly
      expect(result.x).toBeCloseTo(1, 10);
      expect(result.y).toBeCloseTo(1, 10);
      expect(result.z).toBeCloseTo(0, 10);
    });

    it('should rotate correctly for 90-degree inclination', () => {
      const iRad = Math.PI / 2;
      const result = orbitalToEcliptic(0, 1, 0, 0, iRad);
      // y in orbital plane should map to z in ecliptic for 90-degree inclination
      expect(result.z).toBeCloseTo(1, 10);
    });
  });

  describe('heliocentricToEquatorial', () => {
    it('should return valid RA and Dec ranges', () => {
      // Object at (2, 0, 0) AU
      const jd = 2451545.0;
      const result = heliocentricToEquatorial(2, 0, 0, jd);
      expect(result.ra).toBeGreaterThanOrEqual(0);
      expect(result.ra).toBeLessThan(24);
      expect(result.dec).toBeGreaterThanOrEqual(-90);
      expect(result.dec).toBeLessThanOrEqual(90);
      expect(result.distance).toBeGreaterThan(0);
    });

    it('should return RA in hours', () => {
      const jd = 2451545.0;
      const result = heliocentricToEquatorial(5, 0, 0, jd);
      // RA should be in 0-24 hour range
      expect(result.ra).toBeGreaterThanOrEqual(0);
      expect(result.ra).toBeLessThan(24);
    });
  });

  describe('meanMotion', () => {
    it('should return correct value for 1 AU orbit', () => {
      // For a = 1 AU, n = k (Gaussian constant)
      const n = meanMotion(1);
      expect(n).toBeCloseTo(0.01720209895, 10);
    });

    it('should decrease for larger orbits', () => {
      const n1 = meanMotion(1);
      const n2 = meanMotion(5);
      expect(n2).toBeLessThan(n1);
    });
  });
});
