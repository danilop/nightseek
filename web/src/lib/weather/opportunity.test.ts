import { describe, expect, it } from 'vitest';
import { createMockNightInfo, createMockNightWeather } from '@/test/factories';
import type { HourlyWeather } from '@/types';
import { calculateHeadlineNightQuality, calculateWindowNightQuality } from './night-quality';
import { calculateObservingWindows } from './observing-windows';
import { parseNightWeather } from './open-meteo';

const at = (h: number) => new Date(Date.parse('2026-11-03T20:00Z') + h * 3600000);
const night = createMockNightInfo({
  date: at(0),
  observingWindowStart: at(0),
  observingWindowEnd: at(10),
  moonIllumination: 0,
  moonAltitudeSamples: [
    [at(0), -20],
    [at(10), -20],
  ],
});
const hour = (cloudCover: number): HourlyWeather => ({
  cloudCover,
  windSpeed: 5,
  windGust: 7,
  humidity: 50,
  temperature: 10,
  dewPoint: 0,
  visibility: 20000,
  precipitation: 0,
  precipProbability: 0,
  aod: 0.05,
  pm25: 1,
  pm10: 1,
  dust: 0,
  pressure: 1015,
  cape: 0,
});
function weather(clouds: number[]) {
  return createMockNightWeather({ hourlyData: new Map(clouds.map((c, i) => [+at(i), hour(c)])) });
}
function assess(clouds: number[], from = at(0)) {
  const w = weather(clouds);
  const plan = calculateObservingWindows(w, night, from);
  return calculateHeadlineNightQuality(
    {
      ...w,
      bestTime: plan.recommended,
      assessedFrom: plan.assessedFrom,
      observingWindows: plan.windows,
    },
    night
  );
}

describe('practical night opportunity', () => {
  it('does not call a brief excellent gap a five-star night', () => {
    const half = assess([0, ...Array(10).fill(95)], at(0.5));
    const one = assess([0, ...Array(10).fill(95)]);
    const two = assess([0, 0, ...Array(9).fill(95)]);
    const eight = assess([...Array(8).fill(0), 95, 95, 95]);
    expect([half.score, one.score, two.score, eight.score]).toEqual([33, 47, 66, 94]);
    expect([half.rating.stars, one.rating.stars, two.rating.stars, eight.rating.stars]).toEqual([
      2, 3, 4, 5,
    ]);
    expect(half.conditionsScore).toBe(94);
    expect(half.opportunity?.usableHours).toBe(0.5);
    expect(half.opportunity?.label).toBe('Brief opportunity');
  });
  it('discounts repeated short blocks while retaining all usable time', () => {
    const continuous = assess([0, 0, 0, 0, ...Array(7).fill(95)]);
    const split = assess([0, 95, 0, 95, 0, 95, 0, 95, 95, 95, 95]);
    expect(split.opportunity).toMatchObject({ usableHours: 4, longestHours: 1, windowCount: 4 });
    expect(split.score).toBeLessThan(continuous.score);
  });
  it('never reduces opportunity when worse but usable hours are added', () => {
    const short = assess([0, 0, ...Array(9).fill(95)]);
    const longer = assess([0, 0, ...Array(9).fill(60)]);
    expect(longer.score).toBeGreaterThanOrEqual(short.score);
    expect(longer.opportunity?.usableHours).toBe(10);
  });
  it('keeps a long good session and marks its best conditions separately', () => {
    const w = weather([0, 0, ...Array(9).fill(10)]);
    const plan = calculateObservingWindows(w, night);
    expect(plan.recommended).toMatchObject({ start: at(0), end: at(10) });
    // Rounded condition scores tie through 22:30; the longer tied interval wins.
    expect(plan.strongest).toMatchObject({ start: at(0), end: at(2.5) });
  });
  it('never resurrects an expired night from whole-night averages', () => {
    const q = assess(Array(11).fill(0), at(10));
    expect(q.score).toBe(0);
    expect(q.opportunity?.usableHours).toBe(0);
    expect(q.summary).toBe('No remaining opportunity');
    expect(calculateHeadlineNightQuality(null, night).summary).toBe('Opportunity unknown');
  });
  it('keeps cloud thresholds continuous and missing dew explicitly unknown', () => {
    const w = weather(Array(11).fill(0));
    const q = (c: number) => {
      for (const h of w.hourlyData.values()) h.cloudCover = c;
      return calculateWindowNightQuality(w, night, at(0), at(2));
    };
    expect(Math.abs(q(50).score - q(50.01).score)).toBeLessThanOrEqual(1);
    expect(Math.abs(q(60).score - q(60.01).score)).toBeLessThanOrEqual(1);
    for (const h of w.hourlyData.values()) {
      h.cloudCover = 0;
      h.temperature = null;
      h.dewPoint = null;
    }
    const unknown = calculateWindowNightQuality(w, night, at(0), at(2));
    expect(unknown.metrics.dewRiskHours).toBeNull();
    expect(unknown.factors.dewRisk).toBe(50);
    expect(unknown.score).toBeLessThan(75);
  });
  it('checks completeness over the scored interval, not another part of the night', () => {
    const w = weather(Array(11).fill(0));
    const before = calculateWindowNightQuality(w, night, at(0), at(2));
    const later = w.hourlyData.get(+at(8));
    if (later) later.aod = null;
    expect(calculateWindowNightQuality(w, night, at(0), at(2)).score).toBe(before.score);
    const early = w.hourlyData.get(+at(0));
    if (early) early.aod = null;
    expect(calculateWindowNightQuality(w, night, at(0), at(2)).score).toBeLessThan(75);
  });
  it('weights factor explanations by their actual score contribution', () => {
    const q = calculateWindowNightQuality(weather(Array(11).fill(0)), night, at(0), at(2));
    expect(q.penalties.find(p => p.key === 'seeing')?.penalty).toBe(3.75);
    expect(q.penalties.find(p => p.key === 'transparency')?.penalty).toBe(2);
  });
  it('keeps steady dew risk unchanged across fractional dawn boundaries', () => {
    const w = weather(Array(11).fill(0));
    for (const h of w.hourlyData.values()) {
      h.dewPoint = 9;
      h.aod = 0.3;
    }
    const conditions = calculateWindowNightQuality(w, night, at(0), at(5));
    const scores = [5, 5.01, 5.49, 5.5].map(hours => {
      const n = { ...night, observingWindowEnd: at(hours) };
      const q = calculateHeadlineNightQuality(w, n);
      expect(q.score).toBe(conditions.score);
      return q.rating.stars;
    });
    expect(new Set(scores).size).toBe(1);
    const fragment = calculateWindowNightQuality(w, night, at(5), at(5.01));
    expect(fragment.metrics.totalHours).toBeCloseTo(0.01);
    expect(fragment.factors.dewRisk).toBe(0);
  });
  it('preserves and weights dusk/dawn fragments without including daytime weather', () => {
    const times = Array.from({ length: 12 }, (_, i) => +at(i) / 1000);
    const raw = {
      timezone: 'UTC',
      hourly: { time: times, cloud_cover: times.map((_, i): number => (i === 11 ? 100 : 0)) },
    };
    const n = { ...night, observingWindowStart: at(0.5), observingWindowEnd: at(10.5) };
    const result = parseNightWeather(raw, null, n);
    expect(result?.clearDurationHours).toBe(10);
    expect(result?.avgCloudCover).toBe(0);
    expect(result?.bestTime).toMatchObject({ start: at(0.5), end: at(10.5) });
    raw.hourly.cloud_cover[0] = 50;
    expect(parseNightWeather(raw, null, n)?.avgCloudCover).toBeCloseTo(2.5);
  });
});
