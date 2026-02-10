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

    it('returns Bortle 2 for Arctic (lat > 70)', () => {
      const result = calculateBortle(72, 25);
      expect(result.value).toBe(2);
      expect(result.label).toBe('Typical Dark Site');
    });

    it('returns Bortle 2 for Antarctic (lat < -70)', () => {
      const result = calculateBortle(-75, 0);
      expect(result.value).toBe(2);
    });

    it('returns Bortle 1 for central Pacific Ocean', () => {
      const result = calculateBortle(0, -140);
      expect(result.value).toBe(1);
      expect(result.label).toBe('Excellent Dark Site');
    });

    it('returns Bortle 1 for Atlantic Ocean', () => {
      const result = calculateBortle(0, -30);
      expect(result.value).toBe(1);
    });

    it('returns Bortle 1 for Indian Ocean', () => {
      const result = calculateBortle(-10, 75);
      expect(result.value).toBe(1);
    });

    it('returns Bortle 4 for tropical non-ocean (absLat < 25)', () => {
      const result = calculateBortle(10, 10); // Tropical Africa, not matching ocean ranges
      expect(result.value).toBe(4);
      expect(result.label).toBe('Rural/Suburban Transition');
    });

    it('returns Bortle 5 for temperate mid-latitudes (25-55)', () => {
      const result = calculateBortle(45, 10);
      expect(result.value).toBe(5);
      expect(result.label).toBe('Suburban Sky');
    });

    it('returns Bortle 5 for southern temperate mid-latitudes', () => {
      const result = calculateBortle(-35, 150);
      expect(result.value).toBe(5);
    });

    it('returns Bortle 3 for higher latitudes (55-70)', () => {
      const result = calculateBortle(60, 25);
      expect(result.value).toBe(3);
      expect(result.label).toBe('Rural Sky');
    });

    it('returns Bortle 3 for southern higher latitudes (55-70)', () => {
      const result = calculateBortle(-65, 0);
      expect(result.value).toBe(3);
    });

    it('returns consistent values for same coordinates', () => {
      const r1 = calculateBortle(34.05, -118.24);
      const r2 = calculateBortle(34.05, -118.24);
      expect(r1.value).toBe(r2.value);
    });

    it('includes correct nakedEyeLimitingMag for each Bortle value', () => {
      // Bortle 1 (Pacific ocean)
      expect(calculateBortle(0, -140).nakedEyeLimitingMag).toBe(7.6);
      // Bortle 2 (Arctic)
      expect(calculateBortle(75, 0).nakedEyeLimitingMag).toBe(7.1);
      // Bortle 3 (higher latitude)
      expect(calculateBortle(60, 10).nakedEyeLimitingMag).toBe(6.6);
      // Bortle 4 (tropical)
      expect(calculateBortle(10, 10).nakedEyeLimitingMag).toBe(6.2);
      // Bortle 5 (temperate)
      expect(calculateBortle(45, 10).nakedEyeLimitingMag).toBe(5.6);
    });

    it('includes a description for each Bortle score', () => {
      const locations = [
        [0, -140], // Bortle 1
        [75, 0], // Bortle 2
        [60, 10], // Bortle 3
        [10, 10], // Bortle 4
        [45, 10], // Bortle 5
      ] as const;
      for (const [lat, lon] of locations) {
        const result = calculateBortle(lat, lon);
        expect(result.description.length).toBeGreaterThan(20);
      }
    });

    it('returns correct value at boundary lat=25', () => {
      const result = calculateBortle(25, 10);
      expect(result.value).toBe(5); // absLat >= 25 && absLat <= 55
    });

    it('returns correct value at boundary lat=55', () => {
      const result = calculateBortle(55, 10);
      expect(result.value).toBe(5); // absLat >= 25 && absLat <= 55
    });

    it('returns correct value at boundary lat=70', () => {
      const result = calculateBortle(70, 10);
      expect(result.value).toBe(3); // absLat > 55 && absLat <= 70
    });

    it('handles edge of Pacific Ocean region', () => {
      // Just inside: lat=29, lon=-101
      const inside = calculateBortle(29, -101);
      expect(inside.value).toBe(1);
      // Just outside longitude: lat=0, lon=-99
      const outside = calculateBortle(0, -99);
      // Not in Pacific range, not in Atlantic range -> tropical
      expect(outside.value).toBe(4);
    });

    it('handles Indian Ocean boundary (lat < 10)', () => {
      // lat = 9 -> inside Indian Ocean region
      const inside = calculateBortle(9, 75);
      expect(inside.value).toBe(1);
      // lat = 11 -> outside Indian Ocean (lat must be < 10), but still tropical
      const outside = calculateBortle(11, 75);
      expect(outside.value).toBe(4);
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
    it('returns green bg for dark sites (1-3)', () => {
      expect(getBortleBgClass(1)).toContain('green');
      expect(getBortleBgClass(2)).toContain('green');
      expect(getBortleBgClass(3)).toContain('green');
    });

    it('returns yellow bg for suburban (4-5)', () => {
      expect(getBortleBgClass(4)).toContain('yellow');
      expect(getBortleBgClass(5)).toContain('yellow');
    });

    it('returns orange bg for suburban/urban (6-7)', () => {
      expect(getBortleBgClass(6)).toContain('orange');
      expect(getBortleBgClass(7)).toContain('orange');
    });

    it('returns red bg for city (8-9)', () => {
      expect(getBortleBgClass(8)).toContain('red');
      expect(getBortleBgClass(9)).toContain('red');
    });

    it('returns different bg classes for different ranges', () => {
      const dark = getBortleBgClass(2);
      const suburban = getBortleBgClass(5);
      const city = getBortleBgClass(9);
      expect(dark).not.toBe(suburban);
      expect(suburban).not.toBe(city);
    });
  });
});
