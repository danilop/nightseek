import { describe, expect, it } from 'vitest';
import type { NightWeather, SeeingForecast } from '@/types';
import {
  calculateSeeingScore,
  estimateSeeing,
  estimateSeeingAtAltitude,
  getSeeingDescription,
  getSeeingFromWeather,
} from './seeing';

describe('seeing', () => {
  describe('estimateSeeing', () => {
    it('should return good seeing in ideal conditions', () => {
      const result = estimateSeeing(0, 30, 15, 10); // No wind, low humidity

      // Base seeing is 2.0 arcsec, so ideal conditions yield 'good'
      expect(result.rating).toBe('good');
      expect(result.estimatedArcsec).toBeLessThanOrEqual(2);
    });

    it('should degrade with high wind speed', () => {
      const calmResult = estimateSeeing(5, 50, 15, 10);
      const windyResult = estimateSeeing(40, 50, 15, 10);

      expect(windyResult.estimatedArcsec).toBeGreaterThan(calmResult.estimatedArcsec);
    });

    it('should degrade with high humidity', () => {
      const dryResult = estimateSeeing(10, 40, 15, 10);
      const humidResult = estimateSeeing(10, 90, 15, 10);

      expect(humidResult.estimatedArcsec).toBeGreaterThan(dryResult.estimatedArcsec);
    });

    it('should return poor seeing in bad conditions', () => {
      const result = estimateSeeing(50, 95, 20, 18); // High wind, high humidity

      expect(result.rating).toBe('poor');
      expect(result.estimatedArcsec).toBeGreaterThan(3);
    });

    it('should return correct structure', () => {
      const result = estimateSeeing(15, 60);

      expect(result).toHaveProperty('rating');
      expect(result).toHaveProperty('estimatedArcsec');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('recommendation');
      expect(['excellent', 'good', 'fair', 'poor']).toContain(result.rating);
      expect(typeof result.estimatedArcsec).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should have lower confidence when data is missing', () => {
      const fullDataResult = estimateSeeing(15, 60, 15, 10);
      const partialDataResult = estimateSeeing(15, 60);

      expect(fullDataResult.confidence).toBeGreaterThan(partialDataResult.confidence);
    });
  });

  describe('estimateSeeingAtAltitude', () => {
    it('should degrade seeing at lower altitudes', () => {
      const zenithSeeing = estimateSeeingAtAltitude(90, 10, 50);
      const lowAltSeeing = estimateSeeingAtAltitude(30, 10, 50);

      expect(lowAltSeeing.estimatedArcsec).toBeGreaterThan(zenithSeeing.estimatedArcsec);
    });

    it('should have best seeing at zenith (90 degrees)', () => {
      const zenithSeeing = estimateSeeingAtAltitude(90, 10, 50);
      const highSeeing = estimateSeeingAtAltitude(75, 10, 50);
      const medSeeing = estimateSeeingAtAltitude(45, 10, 50);

      expect(zenithSeeing.estimatedArcsec).toBeLessThanOrEqual(highSeeing.estimatedArcsec);
      expect(highSeeing.estimatedArcsec).toBeLessThanOrEqual(medSeeing.estimatedArcsec);
    });

    it('should return poor seeing at horizon', () => {
      const result = estimateSeeingAtAltitude(5, 10, 50);

      expect(result.rating).toBe('poor');
    });

    it('should handle zero altitude', () => {
      const result = estimateSeeingAtAltitude(0, 10, 50);

      expect(result.rating).toBe('poor');
      expect(result.estimatedArcsec).toBeGreaterThan(5);
    });
  });

  describe('getSeeingFromWeather', () => {
    it('should return default forecast when weather is null', () => {
      const result = getSeeingFromWeather(null);

      expect(result.rating).toBe('fair');
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should calculate seeing from weather data', () => {
      const weather: Partial<NightWeather> = {
        avgWindSpeedKmh: 15,
        avgHumidity: 60,
        avgTemperatureC: 15,
      };

      const result = getSeeingFromWeather(weather as NightWeather);

      expect(result).toHaveProperty('rating');
      expect(result).toHaveProperty('estimatedArcsec');
      expect(result.estimatedArcsec).toBeGreaterThan(0);
    });

    it('should estimate worse seeing with high wind', () => {
      const calmWeather: Partial<NightWeather> = {
        avgWindSpeedKmh: 5,
        avgHumidity: 50,
        avgTemperatureC: 15,
      };
      const windyWeather: Partial<NightWeather> = {
        avgWindSpeedKmh: 40,
        avgHumidity: 50,
        avgTemperatureC: 15,
      };

      const calmResult = getSeeingFromWeather(calmWeather as NightWeather);
      const windyResult = getSeeingFromWeather(windyWeather as NightWeather);

      expect(windyResult.estimatedArcsec).toBeGreaterThan(calmResult.estimatedArcsec);
    });
  });

  describe('getSeeingDescription', () => {
    it('should include rating in description', () => {
      const forecast: SeeingForecast = {
        rating: 'excellent',
        estimatedArcsec: 1.0,
        confidence: 0.8,
        recommendation: 'Great for planetary imaging',
      };

      const result = getSeeingDescription(forecast);

      expect(result.toLowerCase()).toContain('excellent');
    });

    it('should include arcsec value', () => {
      const forecast: SeeingForecast = {
        rating: 'good',
        estimatedArcsec: 1.5,
        confidence: 0.7,
        recommendation: 'Good for most imaging',
      };

      const result = getSeeingDescription(forecast);

      expect(result).toContain('1.5');
    });

    it('should indicate low confidence when applicable', () => {
      const forecast: SeeingForecast = {
        rating: 'fair',
        estimatedArcsec: 2.5,
        confidence: 0.5,
        recommendation: 'Limited data',
      };

      const result = getSeeingDescription(forecast);

      expect(result).toContain('low confidence');
    });
  });

  describe('calculateSeeingScore', () => {
    it('should return 8 for excellent seeing', () => {
      const forecast: SeeingForecast = {
        rating: 'excellent',
        estimatedArcsec: 0.8,
        confidence: 0.9,
        recommendation: 'Excellent',
      };

      expect(calculateSeeingScore(forecast)).toBe(8);
    });

    it('should return 6 for good seeing', () => {
      const forecast: SeeingForecast = {
        rating: 'good',
        estimatedArcsec: 1.5,
        confidence: 0.8,
        recommendation: 'Good',
      };

      expect(calculateSeeingScore(forecast)).toBe(6);
    });

    it('should return 3 for fair seeing', () => {
      const forecast: SeeingForecast = {
        rating: 'fair',
        estimatedArcsec: 2.5,
        confidence: 0.7,
        recommendation: 'Fair',
      };

      expect(calculateSeeingScore(forecast)).toBe(3);
    });

    it('should return 0 for poor seeing', () => {
      const forecast: SeeingForecast = {
        rating: 'poor',
        estimatedArcsec: 4.0,
        confidence: 0.6,
        recommendation: 'Poor',
      };

      expect(calculateSeeingScore(forecast)).toBe(0);
    });
  });
});
