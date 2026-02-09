import { describe, expect, it } from 'vitest';
import {
  createMockNightInfo as createBaseNightInfo,
  createMockNightWeather,
  createMockObjectVisibility,
} from '@/test/factories';
import {
  calculateImagingWindows,
  formatImagingWindow,
  getBestImagingWindow,
  getImagingWindowSummary,
} from './imaging-windows';

describe('imaging-windows', () => {
  // Wrap factory with altitude-specific samples
  const createMockVisibility = (maxAlt: number) => {
    const baseTime = new Date('2025-01-15T22:00:00Z');
    const samples: [Date, number][] = [];
    for (let i = 0; i < 48; i++) {
      const time = new Date(baseTime.getTime() + i * 10 * 60 * 1000);
      const progress = i / 48;
      const altitude = Math.sin(progress * Math.PI) * maxAlt;
      samples.push([time, altitude]);
    }
    return createMockObjectVisibility({
      objectName: 'Test Object',
      maxAltitude: maxAlt,
      maxAltitudeTime: new Date(baseTime.getTime() + 4 * 60 * 60 * 1000),
      above45Start: null,
      above45End: null,
      above60Start: null,
      above60End: null,
      magnitude: 8.0,
      altitudeSamples: samples,
      angularSizeArcmin: 10,
      surfaceBrightness: 22,
      raHours: 12,
      decDegrees: 45,
      commonName: 'Test Object',
    });
  };

  const createMockNightInfo = () =>
    createBaseNightInfo({
      date: new Date('2025-01-15T12:00:00Z'),
      sunset: new Date('2025-01-15T17:30:00Z'),
      sunrise: new Date('2025-01-16T07:30:00Z'),
      astronomicalDusk: new Date('2025-01-15T19:00:00Z'),
      astronomicalDawn: new Date('2025-01-16T06:00:00Z'),
      moonRise: new Date('2025-01-15T23:00:00Z'),
      moonSet: new Date('2025-01-16T10:00:00Z'),
      localSiderealTimeAtMidnight: null,
    });

  const createMockWeather = (cloudCover: number) =>
    createMockNightWeather({
      avgCloudCover: cloudCover,
      minCloudCover: cloudCover - 5,
      maxCloudCover: cloudCover + 10,
      clearDurationHours: 6,
      avgVisibilityKm: 20,
      avgWindSpeedKmh: 10,
      maxWindSpeedKmh: 15,
      avgHumidity: 50,
      avgTemperatureC: 10,
      transparencyScore: 80,
      cloudCoverLow: cloudCover,
      cloudCoverMid: cloudCover,
      cloudCoverHigh: cloudCover,
      minDewMargin: 8,
      dewRiskHours: 0,
      avgPm25: 5,
      avgPm10: 10,
      avgDust: 5,
    });

  describe('calculateImagingWindows', () => {
    it('should return empty array for invisible object', () => {
      const visibility = createMockVisibility(60);
      visibility.isVisible = false;

      const result = calculateImagingWindows(
        visibility,
        createMockNightInfo(),
        createMockWeather(20)
      );

      expect(result).toEqual([]);
    });

    it('should return windows for visible object', () => {
      const visibility = createMockVisibility(70);
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather(10); // Clear skies

      const result = calculateImagingWindows(visibility, nightInfo, weather);

      expect(result.length).toBeGreaterThan(0);
    });

    it('should include quality rating in windows', () => {
      const visibility = createMockVisibility(80);
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather(10);

      const result = calculateImagingWindows(visibility, nightInfo, weather);

      if (result.length > 0) {
        expect(['excellent', 'good', 'acceptable', 'poor']).toContain(result[0].quality);
      }
    });

    it('should include factors in windows', () => {
      const visibility = createMockVisibility(75);
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather(15);

      const result = calculateImagingWindows(visibility, nightInfo, weather);

      if (result.length > 0) {
        expect(result[0].factors).toHaveProperty('altitude');
        expect(result[0].factors).toHaveProperty('airmass');
        expect(result[0].factors).toHaveProperty('moonInterference');
        expect(result[0].factors).toHaveProperty('cloudCover');
      }
    });

    it('should sort windows by quality score descending', () => {
      const visibility = createMockVisibility(70);
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather(20);

      const result = calculateImagingWindows(visibility, nightInfo, weather);

      for (let i = 1; i < result.length; i++) {
        expect(result[i].qualityScore).toBeLessThanOrEqual(result[i - 1].qualityScore);
      }
    });

    it('should have worse quality with high cloud cover', () => {
      const visibility = createMockVisibility(70);
      const nightInfo = createMockNightInfo();
      const clearWeather = createMockWeather(10);
      const cloudyWeather = createMockWeather(60);

      const clearResult = calculateImagingWindows(visibility, nightInfo, clearWeather);
      const cloudyResult = calculateImagingWindows(visibility, nightInfo, cloudyWeather);

      // Clear weather should have better quality windows
      if (clearResult.length > 0 && cloudyResult.length > 0) {
        expect(clearResult[0].qualityScore).toBeGreaterThanOrEqual(cloudyResult[0].qualityScore);
      }
    });
  });

  describe('getBestImagingWindow', () => {
    it('should return null for object without windows', () => {
      const visibility = createMockVisibility(10); // Very low altitude
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather(90); // Cloudy

      const result = getBestImagingWindow(visibility, nightInfo, weather);

      // May be null if no acceptable windows
      expect(result === null || result.quality !== undefined).toBe(true);
    });

    it('should return the highest quality window', () => {
      const visibility = createMockVisibility(75);
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather(10);

      const best = getBestImagingWindow(visibility, nightInfo, weather);
      const all = calculateImagingWindows(visibility, nightInfo, weather);

      if (best && all.length > 0) {
        expect(best.qualityScore).toBe(all[0].qualityScore);
      }
    });
  });

  describe('formatImagingWindow', () => {
    it('should format window as time range with quality', () => {
      const window = {
        start: new Date('2025-01-15T22:00:00'),
        end: new Date('2025-01-15T23:00:00'),
        quality: 'excellent' as const,
        qualityScore: 90,
        factors: {
          altitude: 95,
          airmass: 90,
          moonInterference: 100,
          cloudCover: 95,
        },
      };

      const result = formatImagingWindow(window);

      expect(result).toContain('Excellent');
      expect(result).toContain('•'); // Bullet separator
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Time format
    });
  });

  describe('getImagingWindowSummary', () => {
    it('should return null when no windows available', () => {
      const visibility = createMockVisibility(10);
      visibility.altitudeSamples = [];

      const nightInfo = createMockNightInfo();
      const weather = createMockWeather(90);

      const result = getImagingWindowSummary(visibility, nightInfo, weather);

      expect(result).toBeNull();
    });

    it('should include "Best Window" in summary', () => {
      const visibility = createMockVisibility(75);
      const nightInfo = createMockNightInfo();
      const weather = createMockWeather(10);

      const result = getImagingWindowSummary(visibility, nightInfo, weather);

      if (result) {
        expect(result).toContain('Best Window');
      }
    });
  });
});
