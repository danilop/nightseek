import { describe, expect, it } from 'vitest';
import type { NightInfo } from '@/types';
import {
  getMoonPhaseDescription,
  getMoonPhaseEmoji,
  getMoonPhaseEvents,
  getMoonPhaseName,
  getMoonPhasesInRange,
  getNextPhaseOfType,
} from './moon-phases';

describe('moon-phases', () => {
  // Create a mock NightInfo for testing
  const createMockNightInfo = (date: Date): NightInfo => {
    const sunset = new Date(date);
    sunset.setHours(18, 0, 0, 0);
    const sunrise = new Date(date);
    sunrise.setDate(sunrise.getDate() + 1);
    sunrise.setHours(6, 0, 0, 0);

    return {
      date,
      sunset,
      sunrise,
      astronomicalDusk: new Date(sunset.getTime() + 90 * 60 * 1000),
      astronomicalDawn: new Date(sunrise.getTime() - 90 * 60 * 1000),
      moonPhase: 0.5,
      moonIllumination: 100,
      moonRise: null,
      moonSet: null,
      moonPhaseExact: null,
      localSiderealTimeAtMidnight: null,
      seeingForecast: null,
    };
  };

  describe('getMoonPhaseName', () => {
    it('should return correct name for new moon', () => {
      expect(getMoonPhaseName('new')).toBe('New Moon');
    });

    it('should return correct name for first quarter', () => {
      expect(getMoonPhaseName('first_quarter')).toBe('First Quarter');
    });

    it('should return correct name for full moon', () => {
      expect(getMoonPhaseName('full')).toBe('Full Moon');
    });

    it('should return correct name for third quarter', () => {
      expect(getMoonPhaseName('third_quarter')).toBe('Third Quarter');
    });
  });

  describe('getMoonPhaseEmoji', () => {
    it('should return correct emoji for new moon', () => {
      expect(getMoonPhaseEmoji('new')).toBe('\u{1F311}');
    });

    it('should return correct emoji for full moon', () => {
      expect(getMoonPhaseEmoji('full')).toBe('\u{1F315}');
    });
  });

  describe('getMoonPhaseEvents', () => {
    it('should return current and next moon phase events', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const nightInfo = createMockNightInfo(testDate);

      const result = getMoonPhaseEvents(testDate, nightInfo);

      expect(result).toHaveProperty('current');
      expect(result).toHaveProperty('next');
      expect(result.current.phase).toBeDefined();
      expect(result.next.phase).toBeDefined();
      expect(result.current.time).toBeInstanceOf(Date);
      expect(result.next.time).toBeInstanceOf(Date);
    });

    it('should calculate daysUntil correctly', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const nightInfo = createMockNightInfo(testDate);

      const result = getMoonPhaseEvents(testDate, nightInfo);

      // daysUntil for current should be <= 0 (in the past)
      expect(result.current.daysUntil).toBeLessThanOrEqual(0);
      // daysUntil for next should be >= 0 (in the future)
      expect(result.next.daysUntil).toBeGreaterThanOrEqual(0);
    });

    it('should detect tonight event when phase occurs during night', () => {
      // This test verifies the structure - actual timing depends on real moon phases
      const testDate = new Date();
      const nightInfo = createMockNightInfo(testDate);

      const result = getMoonPhaseEvents(testDate, nightInfo);

      // tonightEvent can be null if no phase occurs tonight
      expect(result.tonightEvent === null || result.tonightEvent.isTonight === true).toBe(true);
    });
  });

  describe('getNextPhaseOfType', () => {
    it('should find next full moon', () => {
      const testDate = new Date('2025-01-01T12:00:00Z');

      const result = getNextPhaseOfType(testDate, 'full');

      expect(result.phase).toBe('full');
      expect(result.time.getTime()).toBeGreaterThan(testDate.getTime());
    });

    it('should find next new moon', () => {
      const testDate = new Date('2025-01-01T12:00:00Z');

      const result = getNextPhaseOfType(testDate, 'new');

      expect(result.phase).toBe('new');
      expect(result.time.getTime()).toBeGreaterThan(testDate.getTime());
    });

    it('should have positive daysUntil for future phases', () => {
      const testDate = new Date('2025-01-01T12:00:00Z');

      const result = getNextPhaseOfType(testDate, 'first_quarter');

      expect(result.daysUntil).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getMoonPhasesInRange', () => {
    it('should return multiple phases in a 30 day range', () => {
      const startDate = new Date('2025-01-01T12:00:00Z');
      const endDate = new Date('2025-01-31T12:00:00Z');

      const result = getMoonPhasesInRange(startDate, endDate);

      // A 30-day period should have at least 3-4 moon phases
      expect(result.length).toBeGreaterThanOrEqual(3);
    });

    it('should return phases in chronological order', () => {
      const startDate = new Date('2025-01-01T12:00:00Z');
      const endDate = new Date('2025-02-28T12:00:00Z');

      const result = getMoonPhasesInRange(startDate, endDate);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].time.getTime()).toBeGreaterThan(result[i - 1].time.getTime());
      }
    });

    it('should only return phases within the date range', () => {
      const startDate = new Date('2025-01-01T12:00:00Z');
      const endDate = new Date('2025-01-15T12:00:00Z');

      const result = getMoonPhasesInRange(startDate, endDate);

      for (const phase of result) {
        expect(phase.time.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(phase.time.getTime()).toBeLessThanOrEqual(endDate.getTime());
      }
    });
  });

  describe('getMoonPhaseDescription', () => {
    it('should describe a phase happening today', () => {
      const event = {
        phase: 'full' as const,
        time: new Date(),
        isTonight: false,
        daysUntil: 0,
      };

      const result = getMoonPhaseDescription(event);

      expect(result).toContain('Full Moon');
      expect(result).toContain('today');
    });

    it('should describe a phase happening tonight', () => {
      const event = {
        phase: 'new' as const,
        time: new Date(),
        isTonight: true,
        daysUntil: 0,
      };

      const result = getMoonPhaseDescription(event);

      expect(result).toContain('New Moon');
      expect(result).toContain('at');
    });

    it('should describe a future phase', () => {
      const event = {
        phase: 'first_quarter' as const,
        time: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        isTonight: false,
        daysUntil: 5,
      };

      const result = getMoonPhaseDescription(event);

      expect(result).toContain('First Quarter');
      expect(result).toContain('5 days');
    });
  });
});
