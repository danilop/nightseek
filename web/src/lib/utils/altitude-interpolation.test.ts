import { describe, expect, it } from 'vitest';
import { getAltitudeAtTime } from './altitude-interpolation';

function makeTime(minutesAfterBase: number, base = new Date('2025-01-15T22:00:00')): Date {
  return new Date(base.getTime() + minutesAfterBase * 60_000);
}

function makeSamples(altitudes: number[], intervalMinutes = 10): [Date, number][] {
  return altitudes.map((alt, i) => [makeTime(i * intervalMinutes), alt]);
}

describe('getAltitudeAtTime', () => {
  it('returns 0 for empty samples', () => {
    expect(getAltitudeAtTime([], new Date())).toBe(0);
  });

  it('returns the single value for a single sample', () => {
    const samples = makeSamples([45]);
    expect(getAltitudeAtTime(samples, makeTime(5))).toBe(45);
  });

  it('returns exact value when time matches a sample', () => {
    const samples = makeSamples([10, 30, 50, 40, 20]);
    // Exactly at sample index 2 (20 minutes after base)
    expect(getAltitudeAtTime(samples, makeTime(20))).toBe(50);
  });

  it('interpolates between two samples', () => {
    const samples = makeSamples([10, 30, 50, 40, 20]);
    // Halfway between index 0 (10°) and index 1 (30°) = 20°
    expect(getAltitudeAtTime(samples, makeTime(5))).toBe(20);
  });

  it('interpolates at 25% between samples', () => {
    const samples = makeSamples([0, 40]);
    // 2.5 minutes into a 10-minute interval = 25%
    expect(getAltitudeAtTime(samples, makeTime(2.5))).toBe(10);
  });

  it('returns first sample value when time is before range', () => {
    const samples = makeSamples([30, 50, 40]);
    expect(getAltitudeAtTime(samples, makeTime(-10))).toBe(30);
  });

  it('returns last sample value when time is after range', () => {
    const samples = makeSamples([30, 50, 40]);
    expect(getAltitudeAtTime(samples, makeTime(100))).toBe(40);
  });

  it('handles negative altitudes (below horizon)', () => {
    const samples = makeSamples([-5, 10, 30, 10, -5]);
    // Halfway between -5 and 10 = 2.5
    expect(getAltitudeAtTime(samples, makeTime(5))).toBe(2.5);
  });

  it('works with many samples (binary search correctness)', () => {
    // 60 samples over 10 hours
    const altitudes = Array.from({ length: 60 }, (_, i) => Math.sin((i / 59) * Math.PI) * 70);
    const samples = makeSamples(altitudes);
    // Check midpoint interpolation
    const midTime = makeTime(29.5 * 10); // between index 29 and 30
    const result = getAltitudeAtTime(samples, midTime);
    const expected = (altitudes[29] + altitudes[30]) / 2;
    expect(result).toBeCloseTo(expected, 5);
  });
});
