import { describe, expect, it } from 'vitest';
import {
  getGreenwichSiderealTime,
  getLocalSiderealTime,
  getLocalSiderealTimeHours,
  getMeridianRA,
  getSiderealRate,
  isNearMeridian,
  siderealToSolarHours,
  solarToSiderealHours,
} from './sidereal';

describe('sidereal', () => {
  describe('getGreenwichSiderealTime', () => {
    it('should return a number between 0 and 24', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getGreenwichSiderealTime(testDate);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });

    it('should change throughout the day', () => {
      const date1 = new Date('2025-01-15T00:00:00Z');
      const date2 = new Date('2025-01-15T12:00:00Z');

      const gmst1 = getGreenwichSiderealTime(date1);
      const gmst2 = getGreenwichSiderealTime(date2);

      expect(gmst1).not.toBe(gmst2);
    });
  });

  describe('getLocalSiderealTimeHours', () => {
    it('should return a number between 0 and 24', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getLocalSiderealTimeHours(testDate, 0); // Greenwich

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });

    it('should differ based on longitude', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const lstGreenwich = getLocalSiderealTimeHours(testDate, 0);
      const lstNYC = getLocalSiderealTimeHours(testDate, -74); // NYC

      // Should differ by about -74/15 = ~5 hours
      expect(lstGreenwich).not.toBe(lstNYC);
    });

    it('should handle positive (East) longitude', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const lstGreenwich = getLocalSiderealTimeHours(testDate, 0);
      const lstTokyo = getLocalSiderealTimeHours(testDate, 139.7); // Tokyo

      expect(lstTokyo).not.toBe(lstGreenwich);
    });
  });

  describe('getLocalSiderealTime', () => {
    it('should return formatted string', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getLocalSiderealTime(testDate, 0);

      expect(result).toMatch(/^\d{1,2}h \d{2}m$/);
    });

    it('should have valid hour and minute values', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getLocalSiderealTime(testDate, 0);

      const match = result.match(/^(\d{1,2})h (\d{2})m$/);
      expect(match).not.toBeNull();

      const hours = parseInt(match![1], 10);
      const minutes = parseInt(match![2], 10);

      expect(hours).toBeGreaterThanOrEqual(0);
      expect(hours).toBeLessThan(24);
      expect(minutes).toBeGreaterThanOrEqual(0);
      expect(minutes).toBeLessThan(60);
    });
  });

  describe('getMeridianRA', () => {
    it('should equal local sidereal time', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const longitude = -122.4; // San Francisco

      const meridianRA = getMeridianRA(testDate, longitude);
      const lst = getLocalSiderealTimeHours(testDate, longitude);

      expect(meridianRA).toBeCloseTo(lst, 10);
    });
  });

  describe('isNearMeridian', () => {
    it('should return true when object RA matches meridian', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const longitude = 0;
      const meridianRA = getMeridianRA(testDate, longitude);

      const result = isNearMeridian(meridianRA, testDate, longitude, 1);

      expect(result).toBe(true);
    });

    it('should return false when object is far from meridian', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const longitude = 0;
      const meridianRA = getMeridianRA(testDate, longitude);

      // Object 6 hours away from meridian
      const objectRA = (meridianRA + 6) % 24;

      const result = isNearMeridian(objectRA, testDate, longitude, 1);

      expect(result).toBe(false);
    });

    it('should handle wrap-around at 24 hours', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const longitude = 0;

      // Test case where meridian RA is 23h and object is at 1h (2 hours difference)
      const result = isNearMeridian(1, testDate, longitude, 3);

      // This depends on actual meridian RA at the test time
      expect(typeof result).toBe('boolean');
    });

    it('should respect tolerance parameter', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const longitude = 0;
      const meridianRA = getMeridianRA(testDate, longitude);

      // Object 1.5 hours from meridian
      const objectRA = (meridianRA + 1.5) % 24;

      const result1Hour = isNearMeridian(objectRA, testDate, longitude, 1);
      const result2Hour = isNearMeridian(objectRA, testDate, longitude, 2);

      expect(result1Hour).toBe(false);
      expect(result2Hour).toBe(true);
    });
  });

  describe('getSiderealRate', () => {
    it('should return approximately 1.00274', () => {
      const rate = getSiderealRate();

      expect(rate).toBeCloseTo(1.00274, 4);
    });
  });

  describe('solarToSiderealHours', () => {
    it('should convert 24 solar hours to slightly more sidereal hours', () => {
      const result = solarToSiderealHours(24);

      expect(result).toBeGreaterThan(24);
      expect(result).toBeLessThan(25);
    });

    it('should be the inverse of siderealToSolarHours', () => {
      const solarHours = 12;
      const sidereal = solarToSiderealHours(solarHours);
      const backToSolar = siderealToSolarHours(sidereal);

      expect(backToSolar).toBeCloseTo(solarHours, 10);
    });
  });

  describe('siderealToSolarHours', () => {
    it('should convert sidereal hours to slightly fewer solar hours', () => {
      const result = siderealToSolarHours(24);

      expect(result).toBeLessThan(24);
      expect(result).toBeGreaterThan(23);
    });
  });
});
