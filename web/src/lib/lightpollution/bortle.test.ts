import { describe, expect, it } from 'vitest';
import { calculateBortle, getBortleBgClass, getBortleColorClass } from './bortle';

describe('Bortle estimation', () => {
  describe('calculateBortle', () => {
    it('returns a valid BortleScore', () => {
      const result = calculateBortle(40.7, -74.0); // NYC area
      expect(result.value).toBeGreaterThanOrEqual(1);
      expect(result.value).toBeLessThanOrEqual(9);
      expect(result.label).toBeTruthy();
      expect(result.nakedEyeLimitingMag).toBeGreaterThan(0);
      expect(result.description).toBeTruthy();
    });

    it('returns high Bortle for Arctic', () => {
      const result = calculateBortle(72, 25);
      expect(result.value).toBeLessThanOrEqual(3);
    });

    it('returns low Bortle for central Pacific Ocean', () => {
      const result = calculateBortle(0, -140);
      expect(result.value).toBe(1);
    });

    it('returns suburban-range for mid-latitude defaults', () => {
      const result = calculateBortle(45, 10); // Random mid-latitude
      expect(result.value).toBeGreaterThanOrEqual(3);
      expect(result.value).toBeLessThanOrEqual(7);
    });

    it('returns consistent values for same coordinates', () => {
      const r1 = calculateBortle(34.05, -118.24);
      const r2 = calculateBortle(34.05, -118.24);
      expect(r1.value).toBe(r2.value);
    });
  });

  describe('getBortleColorClass', () => {
    it('returns green for dark sites', () => {
      expect(getBortleColorClass(1)).toContain('green');
      expect(getBortleColorClass(2)).toContain('green');
      expect(getBortleColorClass(3)).toContain('green');
    });

    it('returns yellow for suburban', () => {
      expect(getBortleColorClass(4)).toContain('yellow');
      expect(getBortleColorClass(5)).toContain('yellow');
    });

    it('returns orange for suburban/urban', () => {
      expect(getBortleColorClass(6)).toContain('orange');
      expect(getBortleColorClass(7)).toContain('orange');
    });

    it('returns red for city', () => {
      expect(getBortleColorClass(8)).toContain('red');
      expect(getBortleColorClass(9)).toContain('red');
    });
  });

  describe('getBortleBgClass', () => {
    it('returns different bg classes for different ranges', () => {
      const dark = getBortleBgClass(2);
      const suburban = getBortleBgClass(5);
      const city = getBortleBgClass(9);
      expect(dark).not.toBe(suburban);
      expect(suburban).not.toBe(city);
    });
  });
});
