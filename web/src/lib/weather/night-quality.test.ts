import { describe, expect, it } from 'vitest';
import { createMockNightInfo, createMockNightWeather } from '@/test/factories';
import { calculateNightQuality } from './night-quality';

const createMockWeather = createMockNightWeather;

describe('night-quality', () => {
  describe('calculateNightQuality', () => {
    it('should return excellent rating for ideal conditions', () => {
      const nightInfo = createMockNightInfo({
        moonIllumination: 5,
        seeingForecast: {
          rating: 'excellent',
          estimatedArcsec: 0.8,
          confidence: 0.9,
          recommendation: 'Excellent conditions',
        },
      });
      const weather = createMockWeather({
        avgCloudCover: 5,
        transparencyScore: 95,
        avgWindSpeedKmh: 5,
        dewRiskHours: 0,
      });

      const quality = calculateNightQuality(weather, nightInfo);

      expect(quality.rating.tier).toBe('excellent');
      expect(quality.score).toBeGreaterThanOrEqual(75);
    });

    it('should return poor rating for bad conditions', () => {
      const nightInfo = createMockNightInfo({
        moonIllumination: 95,
        seeingForecast: {
          rating: 'poor',
          estimatedArcsec: 3.5,
          confidence: 0.5,
          recommendation: 'Poor conditions',
        },
      });
      const weather = createMockWeather({
        avgCloudCover: 90,
        transparencyScore: 20,
        avgWindSpeedKmh: 55,
        dewRiskHours: 10,
      });

      const quality = calculateNightQuality(weather, nightInfo);

      expect(quality.rating.tier).toBe('poor');
      expect(quality.score).toBeLessThan(20);
    });

    it('should handle null weather', () => {
      const nightInfo = createMockNightInfo({ moonIllumination: 30 });

      const quality = calculateNightQuality(null, nightInfo);

      // Should still return a valid rating
      expect(quality.rating).toBeDefined();
      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.score).toBeLessThanOrEqual(100);
    });

    it('should calculate factor contributions correctly', () => {
      const nightInfo = createMockNightInfo({ moonIllumination: 0 });
      const weather = createMockWeather({ avgCloudCover: 0 });

      const quality = calculateNightQuality(weather, nightInfo);

      // Cloud factor should be 100 (0% clouds = perfect)
      expect(quality.factors.clouds).toBe(100);
      // Moon factor should be 100 (0% illumination = perfect dark sky)
      expect(quality.factors.moon).toBe(100);
    });

    it('should penalize high cloud cover', () => {
      const nightInfo = createMockNightInfo();
      const clearWeather = createMockWeather({ avgCloudCover: 10 });
      const cloudyWeather = createMockWeather({ avgCloudCover: 80 });

      const clearQuality = calculateNightQuality(clearWeather, nightInfo);
      const cloudyQuality = calculateNightQuality(cloudyWeather, nightInfo);

      expect(clearQuality.score).toBeGreaterThan(cloudyQuality.score);
      expect(clearQuality.factors.clouds).toBeGreaterThan(cloudyQuality.factors.clouds);
    });

    it('should penalize bright moon', () => {
      const darkMoon = createMockNightInfo({ moonIllumination: 5 });
      const fullMoon = createMockNightInfo({ moonIllumination: 100 });
      const weather = createMockWeather();

      const darkQuality = calculateNightQuality(weather, darkMoon);
      const fullQuality = calculateNightQuality(weather, fullMoon);

      expect(darkQuality.score).toBeGreaterThan(fullQuality.score);
      expect(darkQuality.factors.moon).toBeGreaterThan(fullQuality.factors.moon);
    });

    it('should account for seeing conditions', () => {
      const goodSeeing = createMockNightInfo({
        seeingForecast: {
          rating: 'excellent',
          estimatedArcsec: 0.8,
          confidence: 0.9,
          recommendation: 'Excellent',
        },
      });
      const poorSeeing = createMockNightInfo({
        seeingForecast: {
          rating: 'poor',
          estimatedArcsec: 3.5,
          confidence: 0.5,
          recommendation: 'Poor',
        },
      });
      const weather = createMockWeather();

      const goodQuality = calculateNightQuality(weather, goodSeeing);
      const poorQuality = calculateNightQuality(weather, poorSeeing);

      expect(goodQuality.factors.seeing).toBeGreaterThan(poorQuality.factors.seeing);
    });

    it('should penalize high wind', () => {
      const nightInfo = createMockNightInfo();
      const calmWeather = createMockWeather({ avgWindSpeedKmh: 5 });
      const windyWeather = createMockWeather({ avgWindSpeedKmh: 55 });

      const calmQuality = calculateNightQuality(calmWeather, nightInfo);
      const windyQuality = calculateNightQuality(windyWeather, nightInfo);

      expect(calmQuality.factors.wind).toBeGreaterThan(windyQuality.factors.wind);
    });

    it('should penalize dew risk', () => {
      const nightInfo = createMockNightInfo();
      const noDewWeather = createMockWeather({ dewRiskHours: 0 });
      const highDewWeather = createMockWeather({ dewRiskHours: 8 });

      const noDewQuality = calculateNightQuality(noDewWeather, nightInfo);
      const highDewQuality = calculateNightQuality(highDewWeather, nightInfo);

      expect(noDewQuality.factors.dewRisk).toBeGreaterThan(highDewQuality.factors.dewRisk);
    });

    it('should generate a summary string', () => {
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather();

      const quality = calculateNightQuality(weather, nightInfo);

      expect(quality.summary).toBeDefined();
      expect(typeof quality.summary).toBe('string');
      expect(quality.summary.length).toBeGreaterThan(0);
    });

    it('should return rating with correct color', () => {
      const nightInfo = createMockNightInfo({ moonIllumination: 5 });
      const weather = createMockWeather({ avgCloudCover: 5 });

      const quality = calculateNightQuality(weather, nightInfo);

      expect(quality.rating.color).toMatch(/^text-/);
    });

    it('should return score between 0 and 100', () => {
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather();

      const quality = calculateNightQuality(weather, nightInfo);

      expect(quality.score).toBeGreaterThanOrEqual(0);
      expect(quality.score).toBeLessThanOrEqual(100);
    });

    it('should cap at 2 stars when cloud cover exceeds 80%', () => {
      const nightInfo = createMockNightInfo({
        moonIllumination: 5,
        seeingForecast: {
          rating: 'excellent',
          estimatedArcsec: 0.8,
          confidence: 0.9,
          recommendation: 'Excellent',
        },
      });
      // Great conditions except for heavy clouds
      const weather = createMockWeather({
        avgCloudCover: 96,
        transparencyScore: 70,
        avgWindSpeedKmh: 5,
        dewRiskHours: 0,
      });

      const quality = calculateNightQuality(weather, nightInfo);

      expect(quality.rating.stars).toBeLessThanOrEqual(2);
      expect(quality.score).toBeLessThanOrEqual(34);
    });

    it('should cap at 3 stars when cloud cover exceeds 70%', () => {
      const nightInfo = createMockNightInfo({
        moonIllumination: 5,
        seeingForecast: {
          rating: 'excellent',
          estimatedArcsec: 0.8,
          confidence: 0.9,
          recommendation: 'Excellent',
        },
      });
      const weather = createMockWeather({
        avgCloudCover: 75,
        transparencyScore: 90,
        avgWindSpeedKmh: 5,
        dewRiskHours: 0,
      });

      const quality = calculateNightQuality(weather, nightInfo);

      expect(quality.rating.stars).toBeLessThanOrEqual(3);
      expect(quality.score).toBeLessThanOrEqual(49);
    });

    it('should not cap rating when cloud cover is 70% or below', () => {
      const nightInfo = createMockNightInfo({
        moonIllumination: 5,
        seeingForecast: {
          rating: 'excellent',
          estimatedArcsec: 0.8,
          confidence: 0.9,
          recommendation: 'Excellent',
        },
      });
      const weather = createMockWeather({
        avgCloudCover: 10,
        transparencyScore: 95,
        avgWindSpeedKmh: 5,
        dewRiskHours: 0,
      });

      const quality = calculateNightQuality(weather, nightInfo);

      // With ideal conditions and low clouds, should get 4+ stars
      expect(quality.rating.stars).toBeGreaterThanOrEqual(4);
    });
  });
});
