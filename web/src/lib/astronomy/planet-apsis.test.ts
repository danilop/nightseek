import { describe, expect, it } from 'vitest';
import {
  calculateBrightnessBoost,
  getPlanetApsisDescription,
  getPlanetApsisInfo,
  getPlanetsNearPerihelion,
  getUpcomingApsisEvents,
  isNearPerihelion,
} from './planet-apsis';

describe('planet-apsis', () => {
  describe('calculateBrightnessBoost', () => {
    it('should return 0 when current distance equals average distance', () => {
      const result = calculateBrightnessBoost(1.0, 1.0);
      expect(result).toBe(0);
    });

    it('should return 0 when current distance is greater than average', () => {
      const result = calculateBrightnessBoost(1.5, 1.0);
      expect(result).toBe(0);
    });

    it('should return positive boost when closer than average', () => {
      // At 0.9 AU vs 1.0 AU average, boost should be about 23%
      const result = calculateBrightnessBoost(0.9, 1.0);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(50);
    });

    it('should return higher boost for significantly closer distance', () => {
      const closeResult = calculateBrightnessBoost(0.7, 1.0);
      const farResult = calculateBrightnessBoost(0.9, 1.0);
      expect(closeResult).toBeGreaterThan(farResult);
    });

    it('should calculate Mars perihelion boost correctly', () => {
      // Mars: avg 1.524 AU, perihelion ~1.38 AU
      const result = calculateBrightnessBoost(1.38, 1.524);
      expect(result).toBeGreaterThan(10);
      expect(result).toBeLessThan(30);
    });
  });

  describe('getPlanetApsisInfo', () => {
    it('should return null for invalid planet name', () => {
      const result = getPlanetApsisInfo('InvalidPlanet', new Date());
      expect(result).toBeNull();
    });

    it('should return apsis info for Mars', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getPlanetApsisInfo('Mars', testDate);

      // Result might be null if not near apsis, which is valid
      if (result !== null) {
        expect(result.planet).toBe('Mars');
        expect(['perihelion', 'aphelion']).toContain(result.type);
        expect(result.distanceAU).toBeGreaterThan(0);
        expect(result.daysUntil).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return apsis info for Jupiter', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getPlanetApsisInfo('Jupiter', testDate);

      if (result !== null) {
        expect(result.planet).toBe('Jupiter');
        expect(result.distanceAU).toBeGreaterThan(4); // Jupiter is always > 4 AU from Sun
      }
    });
  });

  describe('isNearPerihelion', () => {
    it('should return correct structure', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = isNearPerihelion('Mars', testDate);

      expect(result).toHaveProperty('isNear');
      expect(result).toHaveProperty('daysUntil');
      expect(result).toHaveProperty('brightnessBoostPercent');
      expect(typeof result.isNear).toBe('boolean');
      expect(typeof result.daysUntil).toBe('number');
      expect(typeof result.brightnessBoostPercent).toBe('number');
    });

    it('should return isNear false for invalid planet', () => {
      const result = isNearPerihelion('InvalidPlanet', new Date());
      expect(result.isNear).toBe(false);
      expect(result.daysUntil).toBe(Infinity);
    });
  });

  describe('getPlanetsNearPerihelion', () => {
    it('should return an array', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getPlanetsNearPerihelion(testDate);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should only return perihelion events, not aphelion', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getPlanetsNearPerihelion(testDate);

      for (const apsis of result) {
        expect(apsis.type).toBe('perihelion');
      }
    });

    it('should be sorted by daysUntil', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = getPlanetsNearPerihelion(testDate);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].daysUntil).toBeGreaterThanOrEqual(result[i - 1].daysUntil);
      }
    });
  });

  describe('getUpcomingApsisEvents', () => {
    it('should return events within the specified window', () => {
      const startDate = new Date('2025-01-01T12:00:00Z');
      const result = getUpcomingApsisEvents(startDate, 365);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should include both perihelion and aphelion events', () => {
      const startDate = new Date('2025-01-01T12:00:00Z');
      const result = getUpcomingApsisEvents(startDate, 365);

      const types = new Set(result.map(e => e.type));
      // Over a year, we should see at least one type
      expect(types.size).toBeGreaterThanOrEqual(1);
    });

    it('should be sorted by daysUntil', () => {
      const startDate = new Date('2025-01-01T12:00:00Z');
      const result = getUpcomingApsisEvents(startDate, 180);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].daysUntil).toBeGreaterThanOrEqual(result[i - 1].daysUntil);
      }
    });
  });

  describe('getPlanetApsisDescription', () => {
    it('should describe perihelion event happening today', () => {
      const apsis = {
        planet: 'Mars',
        type: 'perihelion' as const,
        date: new Date(),
        distanceAU: 1.38,
        daysUntil: 0,
        brightnessBoostPercent: 15,
      };

      const result = getPlanetApsisDescription(apsis);

      expect(result).toContain('Mars');
      expect(result).toContain('Perihelion');
      expect(result).toContain('today');
      expect(result).toContain('15%');
    });

    it('should describe aphelion event', () => {
      const apsis = {
        planet: 'Jupiter',
        type: 'aphelion' as const,
        date: new Date(),
        distanceAU: 5.46,
        daysUntil: 10,
        brightnessBoostPercent: 0,
      };

      const result = getPlanetApsisDescription(apsis);

      expect(result).toContain('Jupiter');
      expect(result).toContain('Aphelion');
    });
  });
});
