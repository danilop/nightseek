import { describe, expect, it } from 'vitest';
import { createMockNightInfo, createMockNightWeather } from '@/test/factories';
import type { HourlyWeather } from '@/types';
import { calculateHeadlineNightQuality } from './night-quality';
import { calculateObservingWindows } from './observing-windows';

const start = new Date('2026-11-01T20:00:00Z');
const at = (hours: number) => new Date(Number(start) + hours * 3_600_000);
const night = createMockNightInfo({
  date: new Date('2026-11-01T12:00Z'),
  observingWindowStart: at(0),
  observingWindowEnd: at(10),
  moonIllumination: 100,
  moonAltitudeSamples: [
    [at(0), -20],
    [at(10), -20],
  ],
});
function weather(clouds: number[]) {
  return createMockNightWeather({
    hourlyData: new Map(
      clouds.map((cloudCover, index) => [
        Number(at(index)),
        {
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
        } satisfies HourlyWeather,
      ])
    ),
  });
}

describe('observing periods and recommendation', () => {
  it('retains a whole clear night rather than limiting it to three hours', () => {
    const plan = calculateObservingWindows(weather(Array(11).fill(0)), night);
    expect(plan.windows).toHaveLength(1);
    expect(plan.recommended?.start).toEqual(at(0));
    expect(plan.recommended?.end).toEqual(at(10));
  });
  it('keeps three distinct periods and recommends the longer equally good period', () => {
    const plan = calculateObservingWindows(weather([0, 0, 95, 0, 0, 95, 0, 0, 0, 0, 0]), night);
    expect(plan.windows.map(w => [w.start, w.end])).toEqual([
      [at(0), at(2)],
      [at(3), at(5)],
      [at(6), at(10)],
    ]);
    expect(plan.recommended?.start).toEqual(at(6));
    expect(plan.recommended?.end).toEqual(at(10));
  });
  it('keeps a good one-hour opportunity ending at dawn', () => {
    const plan = calculateObservingWindows(
      weather([95, 95, 95, 95, 95, 95, 95, 95, 95, 0, 0]),
      night
    );
    expect(plan.recommended?.start).toEqual(at(9));
    expect(plan.recommended?.end).toEqual(at(10));
    expect(plan.recommended?.score).toBeGreaterThan(80);
  });
  it('clips to twilight and accepts a supported half-hour opportunity', () => {
    const plan = calculateObservingWindows(weather([0, 0]), {
      ...night,
      observingWindowStart: at(0.5),
    });
    expect(plan.recommended?.start).toEqual(at(0.5));
    expect(plan.recommended?.end).toEqual(at(1));
  });
  it('does not bridge missing forecast hours or rain', () => {
    const data = weather(Array(11).fill(0));
    data.hourlyData.delete(Number(at(3)));
    const rainyHour = data.hourlyData.get(Number(at(7)));
    if (rainyHour) rainyHour.precipitation = 1;
    const plan = calculateObservingWindows(data, night);
    expect(plan.windows.map(w => [w.start, w.end])).toEqual([
      [at(0), at(2)],
      [at(4), at(7)],
      [at(8), at(10)],
    ]);
    expect(plan.recommended?.start).toEqual(at(4));
    expect(plan.recommended?.end).toEqual(at(7));
  });
  it('retains a useful long session and marks its moon-free strongest interval', () => {
    const data = weather(Array(11).fill(0));
    const moonNight = {
      ...night,
      moonAltitudeSamples: [
        [at(0), -20],
        [at(3), 0],
        [at(4), 30],
        [at(10), 40],
      ] as [Date, number][],
    };
    const plan = calculateObservingWindows(data, moonNight);
    expect(plan.windows).toHaveLength(1);
    expect(plan.recommended?.start).toEqual(at(0));
    expect(plan.recommended?.end).toEqual(at(10));
    expect(plan.strongest?.start).toEqual(at(0));
    expect(plan.strongest?.end).toEqual(at(3));
    const headline = calculateHeadlineNightQuality(
      { ...data, bestTime: plan.recommended },
      moonNight
    );
    expect(plan.recommended?.score).toBe(headline.conditionsScore);
  });
  it('distinguishes quality even when incomplete evidence caps both displayed ratings', () => {
    const data = weather([0, 0, 90, 45, 45, 45, 45, 45, 45, 45, 45]);
    for (const hour of data.hourlyData.values()) hour.aod = null;
    const plan = calculateObservingWindows(data, night);
    expect(plan.recommended?.start).toEqual(at(0));
    expect(plan.recommended?.end).toEqual(at(2));
  });
  it('returns no recommendation for rain, missing data or no observing night', () => {
    const data = weather([0, 0, 0]);
    for (const hour of data.hourlyData.values()) hour.precipitation = 1;
    expect(calculateObservingWindows(data, night).recommended).toBeNull();
    expect(calculateObservingWindows(weather([0]), night).windows).toEqual([]);
    expect(
      calculateObservingWindows(weather([0, 0]), { ...night, observingWindowMode: 'none' }).windows
    ).toEqual([]);
  });
});

it('recommends only remaining time and retires elapsed opportunities', () => {
  const data = weather([0, 0, 0, 90, 0, 0, 0, 90, 0, 0, 0]);
  const plan = calculateObservingWindows(data, night, at(1.75));
  expect(plan.windows).toHaveLength(3);
  expect(plan.recommended?.start).toEqual(at(4));
  expect(calculateObservingWindows(data, night, at(9.75)).recommended).toBeNull();
});

it('preserves an isolated clear forecast hour between cloudy hours', () => {
  const plan = calculateObservingWindows(weather([90, 0, 90, 90]), night);
  expect(plan.windows.map(w => [w.start, w.end])).toEqual([[at(1), at(2)]]);
  expect(plan.recommended?.start).toEqual(at(1));
  expect(plan.recommended?.end).toEqual(at(2));
});
