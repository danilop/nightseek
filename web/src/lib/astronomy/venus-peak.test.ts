import { describe, expect, it } from 'vitest';
import type { VenusPeakInfo } from '@/types';
import {
  getCurrentVenusMagnitude,
  getUpcomingVenusPeaks,
  getVenusPeakDescription,
  getVenusPeakInfo,
  isVenusNearPeak,
} from './venus-peak';

describe('venus-peak', () => {
  describe('getVenusPeakInfo', () => {
    it('should return Venus peak info', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getVenusPeakInfo(testDate);

      if (result !== null) {
        expect(result).toHaveProperty('peakDate');
        expect(result).toHaveProperty('peakMagnitude');
        expect(result).toHaveProperty('daysUntil');
        expect(result).toHaveProperty('isNearPeak');
        expect(result.peakDate).toBeInstanceOf(Date);
        expect(typeof result.peakMagnitude).toBe('number');
        expect(typeof result.daysUntil).toBe('number');
        expect(typeof result.isNearPeak).toBe('boolean');
      }
    });

    it('should return negative magnitude for Venus (bright object)', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getVenusPeakInfo(testDate);

      if (result) {
        // Venus peak magnitude is typically around -4.6 to -4.9
        expect(result.peakMagnitude).toBeLessThan(0);
        expect(result.peakMagnitude).toBeGreaterThan(-6);
      }
    });

    it('should have non-negative daysUntil', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getVenusPeakInfo(testDate);

      if (result) {
        expect(result.daysUntil).toBeGreaterThanOrEqual(0);
      }
    });

    it('should mark as near peak when within 14 days', () => {
      // Find an upcoming peak and test dates near it
      const peaks = getUpcomingVenusPeaks(new Date('2025-01-01T12:00:00Z'), 2);

      if (peaks.length > 0) {
        const peakDate = peaks[0].peakDate;

        // Test 5 days before peak
        const testDate = new Date(peakDate);
        testDate.setDate(testDate.getDate() - 5);

        const result = getVenusPeakInfo(testDate);
        if (result && result.daysUntil <= 14) {
          expect(result.isNearPeak).toBe(true);
        }
      }
    });
  });

  describe('isVenusNearPeak', () => {
    it('should return a boolean', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = isVenusNearPeak(testDate);

      expect(typeof result).toBe('boolean');
    });

    it('should match isNearPeak from getVenusPeakInfo', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const peakInfo = getVenusPeakInfo(testDate);
      const isNear = isVenusNearPeak(testDate);

      if (peakInfo) {
        expect(isNear).toBe(peakInfo.isNearPeak);
      }
    });
  });

  describe('getCurrentVenusMagnitude', () => {
    it('should return current Venus magnitude', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getCurrentVenusMagnitude(testDate);

      expect(typeof result).toBe('number');
      // Venus magnitude ranges from about -4.9 to -3.0
      expect(result).toBeLessThan(0);
      expect(result).toBeGreaterThan(-6);
    });

    it('should return different values for different dates', () => {
      const date1 = new Date('2025-01-15T12:00:00Z');
      const date2 = new Date('2025-06-15T12:00:00Z');

      const mag1 = getCurrentVenusMagnitude(date1);
      const mag2 = getCurrentVenusMagnitude(date2);

      // Magnitudes should differ over 5 months
      expect(mag1).not.toBeCloseTo(mag2, 2);
    });
  });

  describe('getVenusPeakDescription', () => {
    it('should describe peak happening today', () => {
      const peakInfo: VenusPeakInfo = {
        peakDate: new Date(),
        peakMagnitude: -4.6,
        daysUntil: 0,
        isNearPeak: true,
      };

      const result = getVenusPeakDescription(peakInfo);

      expect(result).toContain('today');
      expect(result).toContain('-4.6');
    });

    it('should describe Venus near peak within 7 days', () => {
      const peakInfo: VenusPeakInfo = {
        peakDate: new Date(),
        peakMagnitude: -4.7,
        daysUntil: 5,
        isNearPeak: true,
      };

      const result = getVenusPeakDescription(peakInfo);

      expect(result).toContain('near peak brightness');
      expect(result).toContain('-4.7');
    });

    it('should describe Venus approaching peak', () => {
      const peakInfo: VenusPeakInfo = {
        peakDate: new Date(),
        peakMagnitude: -4.5,
        daysUntil: 10,
        isNearPeak: true,
      };

      const result = getVenusPeakDescription(peakInfo);

      expect(result).toContain('approaching peak');
    });

    it('should describe upcoming peak within 30 days', () => {
      const peakInfo: VenusPeakInfo = {
        peakDate: new Date(),
        peakMagnitude: -4.6,
        daysUntil: 25,
        isNearPeak: false,
      };

      const result = getVenusPeakDescription(peakInfo);

      expect(result).toContain('peak in');
      expect(result).toContain('25 days');
    });

    it('should return empty string for distant peak', () => {
      const peakInfo: VenusPeakInfo = {
        peakDate: new Date(),
        peakMagnitude: -4.6,
        daysUntil: 100,
        isNearPeak: false,
      };

      const result = getVenusPeakDescription(peakInfo);

      expect(result).toBe('');
    });
  });

  describe('getUpcomingVenusPeaks', () => {
    it('should return array of Venus peaks', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getUpcomingVenusPeaks(testDate, 2);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return requested number of peaks', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getUpcomingVenusPeaks(testDate, 2);

      expect(result.length).toBeLessThanOrEqual(2);
      // Should find at least one peak within a year
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return peaks in chronological order', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getUpcomingVenusPeaks(testDate, 3);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].peakDate.getTime()).toBeGreaterThan(result[i - 1].peakDate.getTime());
      }
    });

    it('should return peaks with all required properties', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getUpcomingVenusPeaks(testDate, 2);

      for (const peak of result) {
        expect(peak).toHaveProperty('peakDate');
        expect(peak).toHaveProperty('peakMagnitude');
        expect(peak).toHaveProperty('daysUntil');
        expect(peak).toHaveProperty('isNearPeak');
        expect(peak.peakMagnitude).toBeLessThan(0); // Venus is always negative magnitude
      }
    });

    it('should have increasing daysUntil', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getUpcomingVenusPeaks(testDate, 3);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].daysUntil).toBeGreaterThan(result[i - 1].daysUntil);
      }
    });
  });
});
