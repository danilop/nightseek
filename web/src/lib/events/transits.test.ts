import { describe, expect, it } from 'vitest';
import type { PlanetaryTransit } from '@/types';
import {
  getNearestTransit,
  getNextMercuryTransit,
  getNextTransits,
  getNextVenusTransit,
  getTransitAlertSummary,
  getTransitDescription,
  getTransitForDisplay,
  shouldShowTransitAlert,
} from './transits';

describe('transits', () => {
  describe('getNextMercuryTransit', () => {
    it('should return Mercury transit info', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextMercuryTransit(testDate);

      if (result !== null) {
        expect(result.planet).toBe('Mercury');
        expect(result).toHaveProperty('start');
        expect(result).toHaveProperty('peak');
        expect(result).toHaveProperty('finish');
        expect(result).toHaveProperty('separationArcmin');
        expect(result).toHaveProperty('yearsUntil');
        expect(result.start).toBeInstanceOf(Date);
        expect(result.peak).toBeInstanceOf(Date);
        expect(result.finish).toBeInstanceOf(Date);
      }
    });

    it('should have start before peak before finish', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextMercuryTransit(testDate);

      if (result) {
        expect(result.start.getTime()).toBeLessThan(result.peak.getTime());
        expect(result.peak.getTime()).toBeLessThan(result.finish.getTime());
      }
    });

    it('should return transit in the future', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextMercuryTransit(testDate);

      if (result) {
        expect(result.peak.getTime()).toBeGreaterThan(testDate.getTime());
        expect(result.yearsUntil).toBeGreaterThan(0);
      }
    });

    it('should have positive separation', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextMercuryTransit(testDate);

      if (result) {
        expect(result.separationArcmin).toBeGreaterThan(0);
      }
    });
  });

  describe('getNextVenusTransit', () => {
    it('should return Venus transit info', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextVenusTransit(testDate);

      if (result !== null) {
        expect(result.planet).toBe('Venus');
        expect(result).toHaveProperty('start');
        expect(result).toHaveProperty('peak');
        expect(result).toHaveProperty('finish');
      }
    });

    it('should return transit many years in the future', () => {
      // Next Venus transit is December 11, 2117
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextVenusTransit(testDate);

      if (result) {
        // Should be about 92 years away from 2025
        expect(result.yearsUntil).toBeGreaterThan(80);
      }
    });
  });

  describe('getNextTransits', () => {
    it('should return array of transits', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextTransits(testDate, 15);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should find Mercury transits within search window', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextTransits(testDate, 15);

      // Mercury transits occur roughly every 3-13 years
      // In 15 years, we should find at least one
      const mercuryTransits = result.filter(t => t.planet === 'Mercury');
      expect(mercuryTransits.length).toBeGreaterThanOrEqual(1);
    });

    it('should return transits sorted by date', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextTransits(testDate, 15);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].peak.getTime()).toBeGreaterThanOrEqual(result[i - 1].peak.getTime());
      }
    });

    it('should return transits with all required properties', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNextTransits(testDate, 15);

      for (const transit of result) {
        expect(['Mercury', 'Venus']).toContain(transit.planet);
        expect(transit.start).toBeInstanceOf(Date);
        expect(transit.peak).toBeInstanceOf(Date);
        expect(transit.finish).toBeInstanceOf(Date);
        expect(typeof transit.separationArcmin).toBe('number');
        expect(typeof transit.yearsUntil).toBe('number');
      }
    });
  });

  describe('getNearestTransit', () => {
    it('should return the nearest transit', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNearestTransit(testDate);

      if (result) {
        expect(['Mercury', 'Venus']).toContain(result.planet);
      }
    });

    it('should return Mercury transit (closer than Venus)', () => {
      // Mercury transits are much more frequent than Venus
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getNearestTransit(testDate);

      // The nearest transit should be Mercury (Nov 2032) not Venus (2117)
      if (result) {
        expect(result.planet).toBe('Mercury');
      }
    });

    it('should return earliest transit among both planets', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const nearest = getNearestTransit(testDate);
      const mercury = getNextMercuryTransit(testDate);
      const venus = getNextVenusTransit(testDate);

      if (nearest && mercury && venus) {
        const earliestPeak = Math.min(mercury.peak.getTime(), venus.peak.getTime());
        expect(nearest.peak.getTime()).toBe(earliestPeak);
      }
    });
  });

  describe('shouldShowTransitAlert', () => {
    it('should return true for transit within 2 years', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 1.5,
      };

      expect(shouldShowTransitAlert(transit)).toBe(true);
    });

    it('should return false for transit more than 2 years away', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 5,
      };

      expect(shouldShowTransitAlert(transit)).toBe(false);
    });

    it('should return true at exactly 2 years', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 2,
      };

      expect(shouldShowTransitAlert(transit)).toBe(true);
    });
  });

  describe('getTransitForDisplay', () => {
    it('should return nearest transit if within display window', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getTransitForDisplay(testDate);

      // May return null or Mercury transit depending on distance
      if (result) {
        expect(['Mercury', 'Venus']).toContain(result.planet);
      }
    });

    it('should not return Mercury transit if more than 5 years away', () => {
      // Test date after the 2032 Mercury transit
      const testDate = new Date('2035-01-15T12:00:00Z');
      const result = getTransitForDisplay(testDate);

      if (result && result.planet === 'Mercury') {
        expect(result.yearsUntil).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('getTransitDescription', () => {
    it('should include planet name and date', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date('2032-11-13T08:00:00Z'),
        peak: new Date('2032-11-13T10:00:00Z'),
        finish: new Date('2032-11-13T13:00:00Z'),
        separationArcmin: 10,
        yearsUntil: 7.8,
      };

      const result = getTransitDescription(transit);

      expect(result).toContain('Mercury');
      expect(result).toContain('November');
      expect(result).toContain('2032');
    });

    it('should include duration', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date('2032-11-13T08:00:00Z'),
        peak: new Date('2032-11-13T10:00:00Z'),
        finish: new Date('2032-11-13T13:00:00Z'),
        separationArcmin: 10,
        yearsUntil: 7.8,
      };

      const result = getTransitDescription(transit);

      expect(result).toContain('Duration');
      expect(result).toMatch(/\d+h/); // Hours format
    });

    it('should show months for transit less than a year away', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 0.5,
      };

      const result = getTransitDescription(transit);

      expect(result).toContain('months');
    });

    it('should show years for transit more than a year away', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 7.8,
      };

      const result = getTransitDescription(transit);

      expect(result).toContain('years');
    });
  });

  describe('getTransitAlertSummary', () => {
    it('should show months for transit less than a year away', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 0.5,
      };

      const result = getTransitAlertSummary(transit);

      expect(result).toContain('Mercury');
      expect(result).toContain('6 months');
    });

    it('should show decimal years for transit within 2 years', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 1.5,
      };

      const result = getTransitAlertSummary(transit);

      expect(result).toContain('Mercury');
      expect(result).toContain('1.5 years');
    });

    it('should show whole years for distant transit', () => {
      const transit: PlanetaryTransit = {
        planet: 'Mercury',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 7.8,
      };

      const result = getTransitAlertSummary(transit);

      expect(result).toContain('Next Mercury transit');
      expect(result).toContain('8 years');
    });

    it('should handle Venus transit', () => {
      const transit: PlanetaryTransit = {
        planet: 'Venus',
        start: new Date(),
        peak: new Date(),
        finish: new Date(),
        separationArcmin: 10,
        yearsUntil: 92,
      };

      const result = getTransitAlertSummary(transit);

      expect(result).toContain('Venus');
    });
  });
});
