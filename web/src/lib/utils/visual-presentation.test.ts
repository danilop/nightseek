import { describe, expect, it } from 'vitest';
import { calculateMosaicPanels } from '@/lib/scoring';
import { formatFOV } from '@/lib/telescopes';
import { createMockNightInfo, createMockNightWeather } from '@/test/factories';
import type { HourlyWeather } from '@/types';
import { buildNightTimeline, timelinePosition, timelineWeatherAt } from './night-timeline';
import { getFramePresentation } from './target-presentation';
import { formatTemperatureDifference } from './units';

const fov = { width: 128, height: 72 };
const hour = { cloudCover: 10, precipitation: 0, windGust: 10, visibility: 20000 } as HourlyWeather;

describe('shared frame presentation', () => {
  it('warns about cropping even when target area is below frame area', () => {
    expect(getFramePresentation(180, 10, 'dso', fov)).toMatchObject({
      label: 'Extends beyond frame',
      warning: true,
    });
    expect(getFramePresentation(180, 10, 'dso', fov)?.percent).toBeLessThan(100);
  });
  it('uses the same result for portrait and landscape camera frames', () => {
    expect(getFramePresentation(90, 30, 'dso', fov)?.label).toBe('Fits in frame');
    expect(getFramePresentation(90, 30, 'dso', { width: 72, height: 128 })).toEqual(
      getFramePresentation(90, 30, 'dso', fov)
    );
  });
  it('keeps unknown dimensions distinct from a small target', () => {
    expect(getFramePresentation(0, undefined, 'dso', fov)?.label).toBe('Size unknown');
    expect(getFramePresentation(1, 0.5, 'dso', fov)?.label).toBe('Small in frame');
  });
  it('marks estimated minor axes and uses the same fallback in mosaics', () => {
    expect(getFramePresentation(120, undefined, 'dso', fov)?.geometry?.minorEstimated).toBe(true);
    expect(calculateMosaicPanels(120, fov, Infinity)).toEqual(calculateMosaicPanels(120, fov));
    expect(calculateMosaicPanels(120, fov, NaN)).toEqual(calculateMosaicPanels(120, fov));
  });
  it('does not invent a framing result without a device or for planetary imaging', () => {
    expect(getFramePresentation(180, 60, 'dso', null)).toBeNull();
    expect(getFramePresentation(1, 1, 'planet', fov)).toBeNull();
  });
  it('formats camera dimensions and temperature differences consistently', () => {
    expect(formatFOV(128, 72)).toBe('2.13° × 1.2°');
    expect(formatFOV(30, 20)).toBe('30′ × 20′');
    expect(formatTemperatureDifference(5, 'fahrenheit')).toBe('9.0°F');
    expect(formatTemperatureDifference(5, 'celsius')).toBe('5.0°C');
  });
});

describe('shared night timeline', () => {
  const start = new Date('2026-11-01T04:00:00Z');
  const end = new Date('2026-11-01T08:00:00Z');
  const night = createMockNightInfo({
    sunset: start,
    sunrise: end,
    moonAltitudeSamples: [
      [start, -10],
      [end, 10],
    ],
  });
  it('uses real elapsed time across the repeated New York hour', () => {
    expect(timelinePosition(new Date('2026-11-01T05:30:00Z'), start, end)).toBe(37.5);
    expect(timelinePosition(new Date('2026-11-01T06:30:00Z'), start, end)).toBe(62.5);
    expect(timelinePosition(new Date(0), start, end)).toBe(0);
    expect(timelinePosition(end, start, start)).toBe(0);
  });
  it('does not treat missing weather as a clear hour', () => {
    const segments = buildNightTimeline(night, null);
    expect(segments).toHaveLength(16);
    expect(segments.every(s => s.weather === 'unknown')).toBe(true);
    expect(segments.reduce((sum, s) => sum + s.width, 0)).toBeCloseTo(100);
  });
  it('uses shared equipment blockers, not cloud-only colour', () => {
    const weather = createMockNightWeather({
      hourlyData: new Map([
        [Number(start), { ...hour, windGust: 50 }],
        [Number(start) + 3600000, hour],
      ]),
    });
    const segments = buildNightTimeline(night, weather);
    expect(segments[0].weather).toBe('blocked');
    expect(segments[4].weather).toBe('available');
    expect(segments[8].weather).toBe('unknown');
    expect(timelineWeatherAt(Number(end), weather)).toBeNull();
  });
  it('only displays Moon altitude within sampled coverage', () => {
    expect(buildNightTimeline(night, null)[0].moon).toBe('down');
    expect(buildNightTimeline(night, null)[15].moon).toBe('up');
    expect(
      buildNightTimeline({ ...night, moonAltitudeSamples: undefined }, null).every(
        s => s.moon === 'unknown'
      )
    ).toBe(true);
  });
});
