import { describe, expect, it } from 'vitest';
import {
  calculateNightRating,
  formatAltitude,
  formatAngularSize,
  formatDate,
  formatDateRange,
  formatMagnitude,
  formatMoonSeparation,
  formatScore,
  formatTime,
  getAltitudeQualityClass,
  getCategoryIcon,
  getMoonPhaseEmoji,
  getMoonPhaseName,
  getStarRating,
  getTierColorClass,
  getWeatherDescription,
  getWeatherEmoji,
} from './format';

describe('format utils', () => {
  describe('formatTime', () => {
    it('should format time in 12-hour format', () => {
      const date = new Date('2025-01-15T14:30:00');
      const result = formatTime(date);
      expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    });
  });

  describe('formatDate', () => {
    it('should format date with day and month', () => {
      const date = new Date('2025-01-15T12:00:00');
      const result = formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });
  });

  describe('formatDateRange', () => {
    it('should format date range', () => {
      const start = new Date('2025-01-15T12:00:00');
      const end = new Date('2025-01-22T12:00:00');
      const result = formatDateRange(start, end);
      expect(result).toContain('Jan 15');
      expect(result).toContain('Jan 22');
    });
  });

  describe('getMoonPhaseEmoji', () => {
    it('should return new moon emoji for phase 0', () => {
      expect(getMoonPhaseEmoji(0)).toBe('🌑');
    });

    it('should return full moon emoji for phase 0.5', () => {
      expect(getMoonPhaseEmoji(0.5)).toBe('🌕');
    });

    it('should return first quarter for phase 0.25', () => {
      expect(getMoonPhaseEmoji(0.25)).toBe('🌓');
    });

    it('should return last quarter for phase 0.75', () => {
      expect(getMoonPhaseEmoji(0.75)).toBe('🌗');
    });

    it('should wrap around for phase 1', () => {
      expect(getMoonPhaseEmoji(1)).toBe('🌑');
    });
  });

  describe('getMoonPhaseName', () => {
    it('should return New Moon for phase 0', () => {
      expect(getMoonPhaseName(0)).toBe('New Moon');
    });

    it('should return Full Moon for phase 0.5', () => {
      expect(getMoonPhaseName(0.5)).toBe('Full Moon');
    });

    it('should return First Quarter for phase 0.25', () => {
      expect(getMoonPhaseName(0.25)).toBe('First Quarter');
    });

    it('should return Last Quarter for phase 0.75', () => {
      expect(getMoonPhaseName(0.75)).toBe('Last Quarter');
    });
  });

  describe('getWeatherEmoji', () => {
    it('should return sun for clear sky', () => {
      expect(getWeatherEmoji(5)).toBe('☀️');
    });

    it('should return partly cloudy for 25-40%', () => {
      expect(getWeatherEmoji(30)).toBe('⛅');
    });

    it('should return cloudy for 40-60%', () => {
      expect(getWeatherEmoji(50)).toBe('☁️');
    });

    it('should return rain for high cloud cover', () => {
      expect(getWeatherEmoji(80)).toBe('🌧️');
    });
  });

  describe('getWeatherDescription', () => {
    it('should return Clear for low cloud cover', () => {
      expect(getWeatherDescription(5)).toBe('Clear');
    });

    it('should return Mostly Clear for 10-25%', () => {
      expect(getWeatherDescription(20)).toBe('Mostly Clear');
    });

    it('should return Partly Cloudy for 25-40%', () => {
      expect(getWeatherDescription(30)).toBe('Partly Cloudy');
    });

    it('should return Mostly Cloudy for 40-60%', () => {
      expect(getWeatherDescription(50)).toBe('Mostly Cloudy');
    });

    it('should return Overcast for high cloud cover', () => {
      expect(getWeatherDescription(80)).toBe('Overcast');
    });
  });

  describe('getCategoryIcon', () => {
    it('should return planet emoji for planets', () => {
      expect(getCategoryIcon('planet')).toBe('🪐');
    });

    it('should return comet emoji for comets', () => {
      expect(getCategoryIcon('comet')).toBe('☄️');
    });

    it('should return galaxy emoji for galaxy subtype', () => {
      expect(getCategoryIcon('dso', 'galaxy')).toBe('🌀');
    });

    it('should return nebula emoji for nebula subtypes', () => {
      expect(getCategoryIcon('dso', 'emission_nebula')).toBe('☁️');
      expect(getCategoryIcon('dso', 'cluster_nebula')).toBe('☁️');
      expect(getCategoryIcon('dso', 'hii_region')).toBe('☁️');
    });

    it('should return specific emoji for planetary nebula', () => {
      expect(getCategoryIcon('dso', 'planetary_nebula')).toBe('💫');
    });

    it('should return specific emoji for supernova remnant', () => {
      expect(getCategoryIcon('dso', 'supernova_remnant')).toBe('💥');
    });

    it('should return specific emoji for dark nebula', () => {
      expect(getCategoryIcon('dso', 'dark_nebula')).toBe('🌑');
    });

    it('should return cluster emoji for cluster subtypes', () => {
      expect(getCategoryIcon('dso', 'globular_cluster')).toBe('✨');
      expect(getCategoryIcon('dso', 'open_cluster')).toBe('✨');
    });

    it('should return default emoji for unknown categories', () => {
      expect(getCategoryIcon('unknown')).toBe('🌌');
    });
  });

  describe('formatAltitude', () => {
    it('should format altitude with degree symbol', () => {
      expect(formatAltitude(45)).toBe('45°');
    });

    it('should round to nearest degree', () => {
      expect(formatAltitude(45.7)).toBe('46°');
    });
  });

  describe('getAltitudeQualityClass', () => {
    it('should return green for high altitude', () => {
      expect(getAltitudeQualityClass(80)).toBe('text-green-400');
    });

    it('should return blue for good altitude', () => {
      expect(getAltitudeQualityClass(65)).toBe('text-blue-400');
    });

    it('should return yellow for moderate altitude', () => {
      expect(getAltitudeQualityClass(50)).toBe('text-yellow-400');
    });

    it('should return orange for low altitude', () => {
      expect(getAltitudeQualityClass(35)).toBe('text-orange-400');
    });

    it('should return red for very low altitude', () => {
      expect(getAltitudeQualityClass(20)).toBe('text-red-400');
    });
  });

  describe('formatScore', () => {
    it('should format score with default max', () => {
      expect(formatScore(150)).toBe('150/235');
    });

    it('should format score with custom max', () => {
      expect(formatScore(75, 100)).toBe('75/100');
    });
  });

  describe('getTierColorClass', () => {
    // New color scale: blue (poor) → red (fair) → orange (good) → yellow (very_good) → green (excellent)
    it('should return green for excellent', () => {
      expect(getTierColorClass('excellent')).toBe('text-green-400');
    });

    it('should return yellow for very_good', () => {
      expect(getTierColorClass('very_good')).toBe('text-yellow-400');
    });

    it('should return orange for good', () => {
      expect(getTierColorClass('good')).toBe('text-orange-400');
    });

    it('should return red for fair', () => {
      expect(getTierColorClass('fair')).toBe('text-red-400');
    });

    it('should return blue for poor', () => {
      expect(getTierColorClass('poor')).toBe('text-blue-400');
    });
  });

  describe('formatMagnitude', () => {
    it('should format positive magnitude', () => {
      expect(formatMagnitude(8.5)).toBe('8.5');
    });

    it('should format negative magnitude', () => {
      expect(formatMagnitude(-2.5)).toBe('-2.5');
    });

    it('should return dash for null', () => {
      expect(formatMagnitude(null)).toBe('—');
    });
  });

  describe('formatAngularSize', () => {
    it('should format degrees for large sizes', () => {
      expect(formatAngularSize(120)).toBe('2.0°');
    });

    it('should format arcminutes for medium sizes', () => {
      expect(formatAngularSize(30)).toBe("30.0'");
    });

    it('should format arcseconds for small sizes', () => {
      expect(formatAngularSize(0.5)).toBe('30"');
    });
  });

  describe('formatMoonSeparation', () => {
    it('should format separation with degrees', () => {
      expect(formatMoonSeparation(45)).toBe('45° from Moon');
    });

    it('should return dash for null', () => {
      expect(formatMoonSeparation(null)).toBe('—');
    });

    it('should round to nearest degree', () => {
      expect(formatMoonSeparation(45.7)).toBe('46° from Moon');
    });
  });

  describe('getStarRating', () => {
    it('should return filled stars for high rating', () => {
      expect(getStarRating(5)).toBe('★★★★★');
    });

    it('should return mixed stars for medium rating', () => {
      expect(getStarRating(3)).toBe('★★★☆☆');
    });

    it('should return empty stars for low rating', () => {
      expect(getStarRating(1)).toBe('★☆☆☆☆');
    });

    it('should support custom max stars', () => {
      expect(getStarRating(3, 3)).toBe('★★★');
    });
  });

  describe('calculateNightRating', () => {
    it('should return 5 for ideal conditions', () => {
      expect(calculateNightRating(0, 0)).toBe(5);
    });

    it('should penalize high moon illumination', () => {
      expect(calculateNightRating(90, 0)).toBeLessThan(5);
    });

    it('should penalize high cloud cover', () => {
      expect(calculateNightRating(0, 80)).toBeLessThan(5);
    });

    it('should return at least 1', () => {
      expect(calculateNightRating(100, 100)).toBeGreaterThanOrEqual(1);
    });

    it('should handle null cloud cover', () => {
      expect(calculateNightRating(50, null)).toBeGreaterThanOrEqual(1);
    });

    it('should return integer rating', () => {
      const rating = calculateNightRating(40, 35);
      expect(Number.isInteger(rating)).toBe(true);
    });
  });
});
