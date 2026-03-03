import { describe, expect, it } from 'vitest';
import type { HourlyWeather, ImagingWindow, NightWeather } from '@/types';
import { assessMosaicConditions } from './mosaic-conditions';

function makeWeather(overrides: Partial<NightWeather> = {}): NightWeather {
  return {
    date: new Date('2026-03-03'),
    avgCloudCover: 20,
    minCloudCover: 10,
    maxCloudCover: 30,
    clearDurationHours: 6,
    clearWindows: [],
    hourlyData: new Map(),
    avgVisibilityKm: 20,
    avgWindSpeedKmh: 10,
    maxWindSpeedKmh: 20,
    avgHumidity: 50,
    avgTemperatureC: 10,
    transparencyScore: 80,
    cloudCoverLow: 10,
    cloudCoverMid: 10,
    cloudCoverHigh: 10,
    minPrecipProbability: 0,
    maxPrecipProbability: 10,
    totalPrecipitationMm: 0,
    minDewMargin: 5,
    dewRiskHours: 0,
    avgPressureHpa: 1013,
    pressureTrend: 'steady',
    maxCape: 0,
    bestTime: null,
    avgAerosolOpticalDepth: null,
    avgPm25: null,
    avgPm10: null,
    avgDust: null,
    ...overrides,
  };
}

function makeImagingWindow(overrides: Partial<ImagingWindow> = {}): ImagingWindow {
  return {
    start: new Date('2026-03-03T22:00:00Z'),
    end: new Date('2026-03-04T04:00:00Z'),
    quality: 'good',
    qualityScore: 70,
    factors: { altitude: 80, airmass: 75, moonInterference: 60, cloudCover: 85 },
    ...overrides,
  };
}

function makeHourlyData(cloudCovers: number[], startHour = 22): Map<number, HourlyWeather> {
  const map = new Map<number, HourlyWeather>();
  for (let i = 0; i < cloudCovers.length; i++) {
    const date = new Date(`2026-03-03T${String(startHour + i).padStart(2, '0')}:00:00Z`);
    map.set(date.getTime(), {
      cloudCover: cloudCovers[i],
      visibility: 20,
      windSpeed: 10,
      windGust: 15,
      humidity: 50,
      temperature: 10,
      dewPoint: 5,
      precipProbability: 0,
      precipitation: 0,
      pressure: 1013,
      cape: 0,
      aod: null,
      pm25: null,
      pm10: null,
      dust: null,
    });
  }
  return map;
}

const smallMosaic = { cols: 2, rows: 2 };
const largeMosaic = { cols: 4, rows: 3 };
const fov = { width: 90, height: 60 }; // arcmin

describe('assessMosaicConditions', () => {
  describe('returns null when no issues', () => {
    it('should return null for low moon and stable weather', () => {
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 10,
        moonSeparation: 120,
        weather: makeWeather(),
        imagingWindow: null,
      });
      expect(result).toBeNull();
    });
  });

  describe('moon illumination tips', () => {
    it('should return critical tip for bright moon (>=70%)', () => {
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 85,
        moonSeparation: 120,
        weather: null,
        imagingWindow: null,
      });
      expect(result).not.toBeNull();
      const moonTip = result?.tips.find(t => t.id === 'moon-bright');
      expect(moonTip).toBeDefined();
      expect(moonTip?.severity).toBe('critical');
      expect(result?.overallSeverity).toBe('critical');
    });

    it('should return warning tip for moderate moon (40-70%)', () => {
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 55,
        moonSeparation: 120,
        weather: null,
        imagingWindow: null,
      });
      expect(result).not.toBeNull();
      const moonTip = result?.tips.find(t => t.id === 'moon-moderate');
      expect(moonTip).toBeDefined();
      expect(moonTip?.severity).toBe('warning');
    });

    it('should not return moon tip for dark moon (<40%)', () => {
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 25,
        moonSeparation: 120,
        weather: null,
        imagingWindow: null,
      });
      expect(result).toBeNull();
    });
  });

  describe('moon gradient warning', () => {
    it('should warn when gradient delta exceeds 10%', () => {
      // Large mosaic close to moon (footprint-based extent ~5.7°)
      const result = assessMosaicConditions({
        mosaic: largeMosaic,
        fov,
        moonIllumination: 80,
        moonSeparation: 40,
        weather: null,
        imagingWindow: null,
      });
      expect(result).not.toBeNull();
      const gradientTip = result?.tips.find(t => t.id === 'moon-gradient');
      expect(gradientTip).toBeDefined();
      expect(result?.moonGradientWarning).not.toBeNull();
      expect(result?.moonGradientWarning?.gradientDeltaPercent).toBeGreaterThan(10);
    });

    it('should be critical when moon < 45° and mosaic > 3°', () => {
      const result = assessMosaicConditions({
        mosaic: largeMosaic,
        fov,
        moonIllumination: 90,
        moonSeparation: 30,
        weather: null,
        imagingWindow: null,
      });
      expect(result).not.toBeNull();
      const gradientTip = result?.tips.find(t => t.id === 'moon-gradient');
      expect(gradientTip?.severity).toBe('critical');
    });

    it('should not warn when moon separation is null', () => {
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 80,
        moonSeparation: null,
        weather: null,
        imagingWindow: null,
      });
      // Should still have moon illumination tip but no gradient
      expect(result).not.toBeNull();
      expect(result?.tips.find(t => t.id === 'moon-gradient')).toBeUndefined();
      expect(result?.moonGradientWarning).toBeNull();
    });

    it('should not warn when moon illumination is very low', () => {
      const result = assessMosaicConditions({
        mosaic: largeMosaic,
        fov,
        moonIllumination: 5,
        moonSeparation: 30,
        weather: null,
        imagingWindow: null,
      });
      expect(result).toBeNull();
    });
  });

  describe('weather variability', () => {
    it('should warn when cloud cover stddev > 20 during imaging window', () => {
      const hourlyData = makeHourlyData([10, 80, 15, 90, 20, 85]);
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 75, // need condition tips for technique tips
        moonSeparation: 120,
        weather: makeWeather({ hourlyData }),
        imagingWindow: makeImagingWindow(),
      });
      expect(result).not.toBeNull();
      const weatherTip = result?.tips.find(t => t.id === 'weather-variable');
      expect(weatherTip).toBeDefined();
      expect(weatherTip?.severity).toBe('warning');
    });

    it('should not warn for stable cloud cover', () => {
      const hourlyData = makeHourlyData([20, 22, 18, 21, 19, 20]);
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 10,
        moonSeparation: 120,
        weather: makeWeather({ hourlyData }),
        imagingWindow: makeImagingWindow(),
      });
      expect(result).toBeNull();
    });

    it('should add info tip for high humidity', () => {
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 50, // need a condition tip
        moonSeparation: 120,
        weather: makeWeather({ avgHumidity: 90 }),
        imagingWindow: null,
      });
      expect(result).not.toBeNull();
      const humidityTip = result?.tips.find(t => t.id === 'weather-humidity');
      expect(humidityTip).toBeDefined();
      expect(humidityTip?.severity).toBe('info');
    });
  });

  describe('technique tips', () => {
    it('should include panel cycling for >=4 panel mosaics with condition tips', () => {
      const result = assessMosaicConditions({
        mosaic: largeMosaic,
        fov,
        moonIllumination: 75,
        moonSeparation: 120,
        weather: null,
        imagingWindow: null,
      });
      expect(result).not.toBeNull();
      expect(result?.tips.find(t => t.id === 'technique-cycling')).toBeDefined();
    });

    it('should not include technique tips when no condition issues', () => {
      const result = assessMosaicConditions({
        mosaic: largeMosaic,
        fov,
        moonIllumination: 10,
        moonSeparation: 150,
        weather: makeWeather(),
        imagingWindow: null,
      });
      expect(result).toBeNull();
    });
  });

  describe('severity sorting', () => {
    it('should sort tips by severity with critical first', () => {
      const result = assessMosaicConditions({
        mosaic: largeMosaic,
        fov,
        moonIllumination: 85,
        moonSeparation: 30,
        weather: makeWeather({ avgHumidity: 90 }),
        imagingWindow: null,
      });
      expect(result).not.toBeNull();
      const severities = result?.tips.map(t => t.severity) ?? [];
      // Map to numeric order and verify descending (critical=2, warning=1, info=0)
      const order = { critical: 2, warning: 1, info: 0 } as const;
      const numeric = severities.map(s => order[s]);
      const sorted = [...numeric].sort((a, b) => b - a);
      expect(numeric).toEqual(sorted);
    });

    it('should set overallSeverity to worst tip severity', () => {
      const result = assessMosaicConditions({
        mosaic: smallMosaic,
        fov,
        moonIllumination: 50,
        moonSeparation: 120,
        weather: makeWeather({ avgHumidity: 90 }),
        imagingWindow: null,
      });
      expect(result).not.toBeNull();
      expect(result?.overallSeverity).toBe('warning');
    });
  });
});
