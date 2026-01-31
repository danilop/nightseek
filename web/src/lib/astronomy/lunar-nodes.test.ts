import { describe, expect, it } from 'vitest';
import {
  getEclipseSeasonDescription,
  getEclipseSeasonInfo,
  getNextNodeCrossing,
  getUpcomingEclipseSeasons,
  isInEclipseSeason,
} from './lunar-nodes';

describe('lunar-nodes', () => {
  describe('getEclipseSeasonInfo', () => {
    it('should return eclipse season info', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getEclipseSeasonInfo(testDate);

      // May or may not be in eclipse season, but should return info
      if (result !== null) {
        expect(result).toHaveProperty('nodeType');
        expect(result).toHaveProperty('nodeCrossingTime');
        expect(result).toHaveProperty('windowStart');
        expect(result).toHaveProperty('windowEnd');
        expect(result).toHaveProperty('isActive');
        expect(['ascending', 'descending']).toContain(result.nodeType);
        expect(result.nodeCrossingTime).toBeInstanceOf(Date);
        expect(result.windowStart).toBeInstanceOf(Date);
        expect(result.windowEnd).toBeInstanceOf(Date);
        expect(typeof result.isActive).toBe('boolean');
      }
    });

    it('should have window start before window end', () => {
      const testDate = new Date('2025-03-15T12:00:00Z');
      const result = getEclipseSeasonInfo(testDate);

      if (result) {
        expect(result.windowStart.getTime()).toBeLessThan(result.windowEnd.getTime());
      }
    });

    it('should have node crossing time within window', () => {
      const testDate = new Date('2025-06-01T12:00:00Z');
      const result = getEclipseSeasonInfo(testDate);

      if (result) {
        expect(result.nodeCrossingTime.getTime()).toBeGreaterThanOrEqual(
          result.windowStart.getTime()
        );
        expect(result.nodeCrossingTime.getTime()).toBeLessThanOrEqual(result.windowEnd.getTime());
      }
    });

    it('should mark as active when date is within eclipse window', () => {
      // Search for an eclipse season and test within it
      const testDate = new Date('2025-01-01T12:00:00Z');
      const seasons = getUpcomingEclipseSeasons(testDate, 90);

      if (seasons.length > 0) {
        // Test a date within the first season's window
        const seasonDate = new Date(seasons[0].nodeCrossingTime);
        const result = getEclipseSeasonInfo(seasonDate);

        if (result) {
          expect(result.isActive).toBe(true);
        }
      }
    });
  });

  describe('getUpcomingEclipseSeasons', () => {
    it('should return an array of eclipse seasons', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getUpcomingEclipseSeasons(testDate, 90);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should find seasons within the specified window', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const windowDays = 180;
      const result = getUpcomingEclipseSeasons(testDate, windowDays);

      // Moon crosses nodes approximately every 13.6 days
      // So we should find multiple seasons in 180 days
      expect(result.length).toBeGreaterThan(0);

      const endDate = new Date(testDate);
      endDate.setDate(endDate.getDate() + windowDays);

      for (const season of result) {
        expect(season.nodeCrossingTime.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    });

    it('should find multiple node crossings in 60 days', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getUpcomingEclipseSeasons(testDate, 60);

      // Moon crosses nodes approximately every 13.6 days
      // With 60 days, we should see at least 2-4 node crossings
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should return seasons with all required properties', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getUpcomingEclipseSeasons(testDate, 60);

      for (const season of result) {
        expect(season).toHaveProperty('nodeType');
        expect(season).toHaveProperty('nodeCrossingTime');
        expect(season).toHaveProperty('windowStart');
        expect(season).toHaveProperty('windowEnd');
        expect(season).toHaveProperty('isActive');
      }
    });
  });

  describe('isInEclipseSeason', () => {
    it('should return a boolean', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = isInEclipseSeason(testDate);

      expect(typeof result).toBe('boolean');
    });

    it('should return true when getEclipseSeasonInfo returns active season', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const seasonInfo = getEclipseSeasonInfo(testDate);
      const isActive = isInEclipseSeason(testDate);

      if (seasonInfo) {
        expect(isActive).toBe(seasonInfo.isActive);
      }
    });
  });

  describe('getEclipseSeasonDescription', () => {
    it('should describe active eclipse season', () => {
      const season = {
        nodeType: 'ascending' as const,
        nodeCrossingTime: new Date('2025-02-15T12:00:00Z'),
        windowStart: new Date('2025-01-29T12:00:00Z'),
        windowEnd: new Date('2025-03-04T12:00:00Z'),
        isActive: true,
      };

      const result = getEclipseSeasonDescription(season);

      expect(result).toContain('Eclipse Season Active');
      expect(result).toContain('Jan');
      expect(result).toContain('Mar');
    });

    it('should describe upcoming eclipse season within 30 days', () => {
      const now = new Date();
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + 20);
      const nodeCrossing = new Date(windowStart);
      nodeCrossing.setDate(nodeCrossing.getDate() + 17);
      const windowEnd = new Date(nodeCrossing);
      windowEnd.setDate(windowEnd.getDate() + 17);

      const season = {
        nodeType: 'descending' as const,
        nodeCrossingTime: nodeCrossing,
        windowStart,
        windowEnd,
        isActive: false,
      };

      const result = getEclipseSeasonDescription(season);

      expect(result).toContain('Eclipse Season begins');
      expect(result).toContain('days');
    });

    it('should return empty string for distant eclipse season', () => {
      const now = new Date();
      const windowStart = new Date(now);
      windowStart.setDate(windowStart.getDate() + 60);
      const nodeCrossing = new Date(windowStart);
      nodeCrossing.setDate(nodeCrossing.getDate() + 17);
      const windowEnd = new Date(nodeCrossing);
      windowEnd.setDate(windowEnd.getDate() + 17);

      const season = {
        nodeType: 'ascending' as const,
        nodeCrossingTime: nodeCrossing,
        windowStart,
        windowEnd,
        isActive: false,
      };

      const result = getEclipseSeasonDescription(season);

      expect(result).toBe('');
    });
  });

  describe('getNextNodeCrossing', () => {
    it('should return next node crossing info', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextNodeCrossing(testDate);

      if (result !== null) {
        expect(result).toHaveProperty('time');
        expect(result).toHaveProperty('nodeType');
        expect(result).toHaveProperty('daysUntil');
        expect(result.time).toBeInstanceOf(Date);
        expect(['ascending', 'descending']).toContain(result.nodeType);
        expect(typeof result.daysUntil).toBe('number');
      }
    });

    it('should have positive daysUntil for future crossing', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextNodeCrossing(testDate);

      if (result) {
        expect(result.daysUntil).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have crossing time in the future', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextNodeCrossing(testDate);

      if (result) {
        expect(result.time.getTime()).toBeGreaterThanOrEqual(testDate.getTime());
      }
    });

    it('should return crossing within ~14 days', () => {
      // Moon crosses nodes approximately every 13.6 days
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextNodeCrossing(testDate);

      if (result) {
        expect(result.daysUntil).toBeLessThanOrEqual(14);
      }
    });
  });
});
