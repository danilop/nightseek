import { describe, expect, it } from 'vitest';
import type {
  ImagingWindow,
  NightWeather,
  OppositionEvent,
  SeeingForecast,
  VenusPeakInfo,
} from '@/types';
import {
  calculateAltitudeScore,
  calculateDewRiskPenalty,
  calculateElongationBonus,
  calculateFOVSuitabilityScore,
  calculateImagingWindowScore,
  calculateMagnitudeScore,
  calculateMeridianBonus,
  calculateMoonInterference,
  calculateMosaicPanels,
  calculateOppositionBonus,
  calculatePeakTimingScore,
  calculatePerihelionBonus,
  calculateSeasonalWindowScore,
  calculateSeeingQualityScore,
  calculateTransientBonus,
  calculateTwilightPenalty,
  calculateVenusPeakBonus,
  calculateWeatherScore,
  getScoreTier,
  getTierDisplay,
  normalizeScore,
} from './index';

describe('scoring', () => {
  describe('calculateAltitudeScore', () => {
    it('should give max score for low airmass', () => {
      const score = calculateAltitudeScore(1.05, 85);
      expect(score).toBe(38);
    });

    it('should give lower score for high airmass', () => {
      const lowAirmass = calculateAltitudeScore(1.1, 70);
      const highAirmass = calculateAltitudeScore(2.5, 25);
      expect(lowAirmass).toBeGreaterThan(highAirmass);
    });

    it('should use altitude fallback when airmass is Infinity', () => {
      const score = calculateAltitudeScore(Infinity, 60);
      expect(score).toBe(34);
    });

    it('should scale with altitude', () => {
      expect(calculateAltitudeScore(Infinity, 80)).toBeGreaterThan(
        calculateAltitudeScore(Infinity, 50)
      );
    });
  });

  describe('calculateMoonInterference', () => {
    it('should give high score for planets', () => {
      const score = calculateMoonInterference(100, 30, 'planet', null);
      expect(score).toBe(27);
    });

    it('should give max score for dark sky', () => {
      const score = calculateMoonInterference(3, 60, 'dso', 'galaxy');
      expect(score).toBe(30);
    });

    it('should penalize close moon separation', () => {
      const farMoon = calculateMoonInterference(80, 100, 'dso', 'galaxy');
      const closeMoon = calculateMoonInterference(80, 20, 'dso', 'galaxy');
      expect(farMoon).toBeGreaterThan(closeMoon);
    });

    it('should apply sensitivity factor for nebulae', () => {
      const galaxy = calculateMoonInterference(70, 50, 'dso', 'galaxy');
      const emissionNebula = calculateMoonInterference(70, 50, 'dso', 'emission_nebula');
      // Emission nebulae are more sensitive to moonlight
      expect(galaxy).toBeGreaterThanOrEqual(emissionNebula);
    });
  });

  describe('calculatePeakTimingScore', () => {
    it('should give max score when peak is during observation window', () => {
      const dusk = new Date('2025-01-15T19:00:00Z');
      const dawn = new Date('2025-01-16T06:00:00Z');
      const peak = new Date('2025-01-16T00:00:00Z');

      const score = calculatePeakTimingScore(peak, dusk, dawn);
      expect(score).toBe(15);
    });

    it('should give lower score when peak is outside window', () => {
      const dusk = new Date('2025-01-15T19:00:00Z');
      const dawn = new Date('2025-01-16T06:00:00Z');
      const peak = new Date('2025-01-15T16:00:00Z'); // 3 hours before dusk

      const score = calculatePeakTimingScore(peak, dusk, dawn);
      expect(score).toBeLessThan(15);
    });

    it('should handle null peak time', () => {
      const dusk = new Date('2025-01-15T19:00:00Z');
      const dawn = new Date('2025-01-16T06:00:00Z');

      const score = calculatePeakTimingScore(null, dusk, dawn);
      expect(score).toBe(3);
    });
  });

  describe('calculateWeatherScore', () => {
    it('should return middle score when no weather', () => {
      const score = calculateWeatherScore(null, 'dso', null);
      expect(score).toBe(5);
    });

    it('should give high score for clear skies', () => {
      const weather: Partial<NightWeather> = {
        avgCloudCover: 5,
        avgAerosolOpticalDepth: 0.05,
        transparencyScore: 90,
        maxPrecipProbability: 5,
        maxWindSpeedKmh: 10,
      };

      const score = calculateWeatherScore(weather as NightWeather, 'dso', 'galaxy');
      expect(score).toBeGreaterThan(8);
    });

    it('should penalize high cloud cover', () => {
      const clear: Partial<NightWeather> = {
        avgCloudCover: 10,
        avgAerosolOpticalDepth: 0.05,
        transparencyScore: 80,
        maxPrecipProbability: 5,
        maxWindSpeedKmh: 10,
      };
      const cloudy: Partial<NightWeather> = {
        avgCloudCover: 80,
        avgAerosolOpticalDepth: 0.05,
        transparencyScore: 80,
        maxPrecipProbability: 5,
        maxWindSpeedKmh: 10,
      };

      const clearScore = calculateWeatherScore(clear as NightWeather, 'dso', null);
      const cloudyScore = calculateWeatherScore(cloudy as NightWeather, 'dso', null);

      expect(clearScore).toBeGreaterThan(cloudyScore);
    });
  });

  describe('calculateMagnitudeScore', () => {
    it('should give high score for bright planets', () => {
      const score = calculateMagnitudeScore(-2.5, 'planet');
      expect(score).toBe(15);
    });

    it('should give high score for bright comets', () => {
      const score = calculateMagnitudeScore(5, 'comet');
      expect(score).toBe(15);
    });

    it('should scale with magnitude for DSOs', () => {
      const bright = calculateMagnitudeScore(6, 'dso');
      const dim = calculateMagnitudeScore(12, 'dso');
      expect(bright).toBeGreaterThan(dim);
    });

    it('should return middle score for null magnitude', () => {
      const score = calculateMagnitudeScore(null, 'dso');
      expect(score).toBe(7.5);
    });
  });

  describe('calculateTransientBonus', () => {
    it('should give max bonus for interstellar objects', () => {
      const score = calculateTransientBonus('comet', true);
      expect(score).toBe(25);
    });

    it('should give bonus for comets', () => {
      const score = calculateTransientBonus('comet', false);
      expect(score).toBe(12.5);
    });

    it('should give bonus for asteroids', () => {
      const score = calculateTransientBonus('asteroid', false);
      expect(score).toBe(7.5);
    });

    it('should give no bonus for static objects', () => {
      const score = calculateTransientBonus('dso', false);
      expect(score).toBe(0);
    });
  });

  describe('calculateSeasonalWindowScore', () => {
    it('should give max score when object is opposite sun', () => {
      // Object RA 12h, Sun RA 0h = 12 hour difference (opposite)
      const score = calculateSeasonalWindowScore(12, 0);
      expect(score).toBe(15);
    });

    it('should give low score when object is near sun', () => {
      // Object RA 0h, Sun RA 0h = same direction
      const score = calculateSeasonalWindowScore(0, 0);
      expect(score).toBe(0);
    });
  });

  describe('calculateOppositionBonus', () => {
    it('should give max bonus when at opposition', () => {
      const score = calculateOppositionBonus('Mars', true, []);
      expect(score).toBe(20);
    });

    it('should give bonus from oppositions list', () => {
      const oppositions: OppositionEvent[] = [
        {
          planet: 'Mars',
          date: new Date(),
          daysUntil: 0,
          isActive: true,
        },
      ];

      const score = calculateOppositionBonus('Mars', false, oppositions);
      expect(score).toBe(20);
    });

    it('should scale bonus based on days from opposition', () => {
      const oppositions: OppositionEvent[] = [
        {
          planet: 'Jupiter',
          date: new Date(),
          daysUntil: 7,
          isActive: true,
        },
      ];

      const score = calculateOppositionBonus('Jupiter', false, oppositions);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(20);
    });

    it('should return 0 when not at opposition', () => {
      const score = calculateOppositionBonus('Mars', false, []);
      expect(score).toBe(0);
    });
  });

  describe('calculateElongationBonus', () => {
    it('should give bonus for Mercury at high elongation', () => {
      const score = calculateElongationBonus(26, 'Mercury');
      expect(score).toBeGreaterThan(10);
    });

    it('should give bonus for Venus at high elongation', () => {
      const score = calculateElongationBonus(45, 'Venus');
      expect(score).toBeGreaterThan(10);
    });

    it('should return 0 for outer planets', () => {
      const score = calculateElongationBonus(180, 'Mars');
      expect(score).toBe(0);
    });

    it('should return 0 when elongation is undefined', () => {
      const score = calculateElongationBonus(undefined, 'Venus');
      expect(score).toBe(0);
    });
  });

  describe('calculatePerihelionBonus', () => {
    it('should give bonus for planet near perihelion', () => {
      const score = calculatePerihelionBonus(true, 15, 'planet');
      expect(score).toBeGreaterThan(0);
    });

    it('should scale with brightness boost', () => {
      const lowBoost = calculatePerihelionBonus(true, 5, 'planet');
      const highBoost = calculatePerihelionBonus(true, 20, 'planet');
      expect(highBoost).toBeGreaterThan(lowBoost);
    });

    it('should return 0 for non-planets', () => {
      const score = calculatePerihelionBonus(true, 15, 'dso');
      expect(score).toBe(0);
    });

    it('should return 0 when not near perihelion', () => {
      const score = calculatePerihelionBonus(false, 0, 'planet');
      expect(score).toBe(0);
    });
  });

  describe('calculateMeridianBonus', () => {
    it('should give max bonus when on meridian', () => {
      const score = calculateMeridianBonus(0);
      expect(score).toBe(5);
    });

    it('should give bonus near meridian', () => {
      // 0.5 hours from meridian = within 1 hour, so score is 4
      const score = calculateMeridianBonus(0.5);
      expect(score).toBe(4);
    });

    it('should give no bonus far from meridian', () => {
      const score = calculateMeridianBonus(6);
      expect(score).toBe(0);
    });

    it('should return 0 for undefined hour angle', () => {
      const score = calculateMeridianBonus(undefined);
      expect(score).toBe(0);
    });
  });

  describe('calculateTwilightPenalty', () => {
    it('should penalize objects close to sun', () => {
      const score = calculateTwilightPenalty(10, 'dso');
      expect(score).toBe(-30);
    });

    it('should have less penalty for planets', () => {
      const dsoScore = calculateTwilightPenalty(20, 'dso');
      const planetScore = calculateTwilightPenalty(20, 'planet');
      expect(planetScore).toBeGreaterThan(dsoScore);
    });

    it('should return 0 for objects far from sun', () => {
      const score = calculateTwilightPenalty(60, 'dso');
      expect(score).toBe(0);
    });

    it('should return 0 for undefined sun angle', () => {
      const score = calculateTwilightPenalty(undefined, 'dso');
      expect(score).toBe(0);
    });
  });

  describe('calculateVenusPeakBonus', () => {
    it('should give bonus for Venus near peak', () => {
      const venusPeak: VenusPeakInfo = {
        peakDate: new Date(),
        peakMagnitude: -4.6,
        daysUntil: 5,
        isNearPeak: true,
      };

      const score = calculateVenusPeakBonus('Venus', venusPeak);
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 for non-Venus objects', () => {
      const venusPeak: VenusPeakInfo = {
        peakDate: new Date(),
        peakMagnitude: -4.6,
        daysUntil: 5,
        isNearPeak: true,
      };

      const score = calculateVenusPeakBonus('Mars', venusPeak);
      expect(score).toBe(0);
    });

    it('should return 0 when Venus is not near peak', () => {
      const venusPeak: VenusPeakInfo = {
        peakDate: new Date(),
        peakMagnitude: -4.6,
        daysUntil: 30,
        isNearPeak: false,
      };

      const score = calculateVenusPeakBonus('Venus', venusPeak);
      expect(score).toBe(0);
    });
  });

  describe('calculateSeeingQualityScore', () => {
    it('should give max score for excellent seeing', () => {
      const forecast: SeeingForecast = {
        rating: 'excellent',
        estimatedArcsec: 0.8,
        confidence: 0.9,
        recommendation: 'Excellent',
      };

      const score = calculateSeeingQualityScore(forecast, 'planet');
      expect(score).toBe(8);
    });

    it('should give reduced score for non-planets', () => {
      const forecast: SeeingForecast = {
        rating: 'excellent',
        estimatedArcsec: 0.8,
        confidence: 0.9,
        recommendation: 'Excellent',
      };

      const planetScore = calculateSeeingQualityScore(forecast, 'planet');
      const dsoScore = calculateSeeingQualityScore(forecast, 'dso');
      expect(planetScore).toBeGreaterThan(dsoScore);
    });

    it('should return middle score when forecast is null', () => {
      const score = calculateSeeingQualityScore(null, 'planet');
      expect(score).toBe(4);
    });
  });

  describe('calculateDewRiskPenalty', () => {
    it('should return 0 when no weather data', () => {
      const score = calculateDewRiskPenalty(null);
      expect(score).toBe(0);
    });

    it('should penalize high dew risk', () => {
      const weather: Partial<NightWeather> = {
        minDewMargin: 1,
      };

      const score = calculateDewRiskPenalty(weather as NightWeather);
      expect(score).toBe(-5);
    });

    it('should return 0 for low dew risk', () => {
      const weather: Partial<NightWeather> = {
        minDewMargin: 10,
      };

      const score = calculateDewRiskPenalty(weather as NightWeather);
      expect(score).toBe(0);
    });

    it('should use humidity fallback when dew margin is null', () => {
      const weather: Partial<NightWeather> = {
        minDewMargin: null,
        avgHumidity: 95,
      };

      const score = calculateDewRiskPenalty(weather as NightWeather);
      expect(score).toBe(-5);
    });
  });

  describe('getScoreTier', () => {
    it('should return excellent for score >= 150', () => {
      expect(getScoreTier(150)).toBe('excellent');
      expect(getScoreTier(200)).toBe('excellent');
    });

    it('should return very_good for score >= 100', () => {
      expect(getScoreTier(100)).toBe('very_good');
      expect(getScoreTier(149)).toBe('very_good');
    });

    it('should return good for score >= 75', () => {
      expect(getScoreTier(75)).toBe('good');
      expect(getScoreTier(99)).toBe('good');
    });

    it('should return fair for score >= 40', () => {
      expect(getScoreTier(40)).toBe('fair');
      expect(getScoreTier(74)).toBe('fair');
    });

    it('should return poor for score < 40', () => {
      expect(getScoreTier(39)).toBe('poor');
      expect(getScoreTier(0)).toBe('poor');
    });
  });

  describe('getTierDisplay', () => {
    it('should return correct display for excellent', () => {
      const display = getTierDisplay('excellent');
      expect(display.stars).toBe(5);
      expect(display.label).toBe('Excellent');
      expect(display.color).toBe('text-green-400');
    });

    it('should return correct display for poor', () => {
      const display = getTierDisplay('poor');
      expect(display.stars).toBe(1);
      expect(display.label).toBe('Poor');
      expect(display.color).toBe('text-blue-400');
    });

    it('should include correct color class for each tier', () => {
      // New color scale: blue (poor) → red (fair) → orange (good) → yellow (very_good) → green (excellent)
      expect(getTierDisplay('excellent').color).toBe('text-green-400');
      expect(getTierDisplay('very_good').color).toBe('text-yellow-400');
      expect(getTierDisplay('good').color).toBe('text-orange-400');
      expect(getTierDisplay('fair').color).toBe('text-red-400');
      expect(getTierDisplay('poor').color).toBe('text-blue-400');
    });
  });

  describe('calculateImagingWindowScore', () => {
    const baseWeather = { avgCloudCover: 20 } as NightWeather;

    it('should return neutral score when no weather data', () => {
      const score = calculateImagingWindowScore(undefined, null);
      expect(score).toBe(10);
    });

    it('should return 0 when weather exists but no imaging window', () => {
      const score = calculateImagingWindowScore(undefined, baseWeather);
      expect(score).toBe(0);
    });

    it('should score excellent window highly', () => {
      const window: ImagingWindow = {
        start: new Date('2025-01-15T22:00:00Z'),
        end: new Date('2025-01-16T03:00:00Z'), // 5 hours
        quality: 'excellent',
        qualityScore: 90,
        factors: { altitude: 90, airmass: 85, moonInterference: 95, cloudCover: 88 },
      };

      const score = calculateImagingWindowScore(window, baseWeather);
      expect(score).toBe(25); // 20 base + 5 duration bonus (5h > 3h)
    });

    it('should score acceptable window lower', () => {
      const window: ImagingWindow = {
        start: new Date('2025-01-15T23:00:00Z'),
        end: new Date('2025-01-16T01:00:00Z'), // 2 hours
        quality: 'acceptable',
        qualityScore: 55,
        factors: { altitude: 60, airmass: 55, moonInterference: 50, cloudCover: 55 },
      };

      const score = calculateImagingWindowScore(window, baseWeather);
      expect(score).toBeLessThan(15);
      expect(score).toBeGreaterThan(0);
    });

    it('should give duration bonus for long windows', () => {
      const shortWindow: ImagingWindow = {
        start: new Date('2025-01-15T23:00:00Z'),
        end: new Date('2025-01-15T23:30:00Z'), // 30 min
        quality: 'good',
        qualityScore: 75,
        factors: { altitude: 80, airmass: 75, moonInterference: 80, cloudCover: 70 },
      };

      const longWindow: ImagingWindow = {
        start: new Date('2025-01-15T22:00:00Z'),
        end: new Date('2025-01-16T02:00:00Z'), // 4 hours
        quality: 'good',
        qualityScore: 75,
        factors: { altitude: 80, airmass: 75, moonInterference: 80, cloudCover: 70 },
      };

      const shortScore = calculateImagingWindowScore(shortWindow, baseWeather);
      const longScore = calculateImagingWindowScore(longWindow, baseWeather);
      expect(longScore).toBeGreaterThan(shortScore);
    });
  });

  describe('normalizeScore', () => {
    it('should normalize score to 0-100 range', () => {
      expect(normalizeScore(117.5, 235)).toBe(50);
      expect(normalizeScore(176.25, 235)).toBe(75);
      expect(normalizeScore(235, 235)).toBe(100);
    });

    it('should clamp values', () => {
      expect(normalizeScore(250, 235)).toBe(100);
      expect(normalizeScore(-50, 235)).toBe(0);
    });

    it('should handle maxScore of 0', () => {
      expect(normalizeScore(50, 0)).toBe(0);
    });
  });

  describe('calculateFOVSuitabilityScore', () => {
    const seestarFOV = { width: 42, height: 42 };
    const dwarfMiniFOV = { width: 144, height: 72 };

    it('should give full score for objects filling the FOV well', () => {
      // M42 at 90' on Seestar (90/42 = 2.14 fill ratio > 0.10)
      expect(calculateFOVSuitabilityScore(90, 'dso', seestarFOV)).toBe(15);
    });

    it('should give reduced score for small objects', () => {
      // M57 Ring Nebula at 1.4' on Dwarf Mini (1.4/72 = 0.019)
      expect(calculateFOVSuitabilityScore(1.4, 'dso', dwarfMiniFOV)).toBe(4);
    });

    it('should give 0 for essentially point sources', () => {
      // Very tiny object (0.5' on 72' FOV = 0.007)
      expect(calculateFOVSuitabilityScore(0.5, 'dso', dwarfMiniFOV)).toBe(0);
    });

    it('should return neutral score for planets', () => {
      expect(calculateFOVSuitabilityScore(0.5, 'planet', seestarFOV)).toBe(10);
    });

    it('should return neutral score for Moon', () => {
      expect(calculateFOVSuitabilityScore(30, 'moon', seestarFOV)).toBe(10);
    });

    it('should return neutral score when FOV is null', () => {
      expect(calculateFOVSuitabilityScore(90, 'dso', null)).toBe(10);
    });

    it('should return neutral score for unknown size (0)', () => {
      expect(calculateFOVSuitabilityScore(0, 'dso', seestarFOV)).toBe(10);
    });

    it('should give 12 for medium fill ratio', () => {
      // M1 Crab at 6' on Dwarf Mini (6/72 = 0.083)
      expect(calculateFOVSuitabilityScore(6, 'dso', dwarfMiniFOV)).toBe(12);
    });
  });

  describe('calculateMosaicPanels', () => {
    it('should return null when object fits in frame', () => {
      expect(calculateMosaicPanels(30, { width: 42, height: 42 })).toBeNull();
    });

    it('should calculate fractional mosaic for large square object', () => {
      // M42 at 90' on Seestar S50 (42x42) — 90/42=2.14 → 2
      const mosaic = calculateMosaicPanels(90, { width: 42, height: 42 });
      expect(mosaic).toEqual({ cols: 2, rows: 2 });
    });

    it('should handle rectangular FOV with square object', () => {
      // M42 at 90' on Dwarf Mini (128x72) — 90/128=0.7→1, 90/72=1.25→1.5
      const mosaic = calculateMosaicPanels(90, { width: 128, height: 72 });
      expect(mosaic).toEqual({ cols: 1, rows: 1.5 });
    });

    it('should calculate M31 on Dwarf Mini correctly', () => {
      // M31 at 178'x70' on Dwarf Mini (128x72)
      // Best: 178/128=1.39→1.5, 70/72=0.97→1 → 1.5×1
      const mosaic = calculateMosaicPanels(178, { width: 128, height: 72 }, 70);
      expect(mosaic).toEqual({ cols: 1.5, rows: 1 });
    });

    it('should pick best orientation for elongated objects', () => {
      // 100'x30' object on 42x42 FOV
      // Normal: 100/42=2.5, 30/42=0.5→1 → 2.5×1=2.5 panels
      // Rotated: 30/42=0.5→1, 100/42=2.5 → 1×2.5=2.5 panels (same)
      const mosaic = calculateMosaicPanels(100, { width: 42, height: 42 }, 30);
      expect(mosaic).toEqual({ cols: 2.5, rows: 1 });
    });

    it('should return null when elongated object fits rotated', () => {
      // 60'x30' on 128x72 FOV — fits in single frame
      expect(calculateMosaicPanels(60, { width: 128, height: 72 }, 30)).toBeNull();
    });

    it('should return null when FOV is null', () => {
      expect(calculateMosaicPanels(90, null)).toBeNull();
    });

    it('should return null for zero size', () => {
      expect(calculateMosaicPanels(0, { width: 42, height: 42 })).toBeNull();
    });
  });
});
