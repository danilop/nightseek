import { describe, expect, it } from 'vitest';
import { calculateMoonlightInfo } from './moonlight';

describe('calculateMoonlightInfo', () => {
  const start = new Date('2026-07-16T22:00:00Z');
  const end = new Date('2026-07-17T02:00:00Z');

  it('reports no moonlight when the Moon remains below the horizon', () => {
    const result = calculateMoonlightInfo(
      90,
      [
        [start, -10],
        [end, -5],
      ],
      start,
      end
    );

    expect(result.visibleHours).toBe(0);
    expect(result.exposurePercent).toBe(0);
    expect(result.level).toBe('none');
  });

  it('weights illumination by the time the Moon is above the horizon', () => {
    const midpoint = new Date('2026-07-17T00:00:00Z');
    const result = calculateMoonlightInfo(
      80,
      [
        [start, -10],
        [midpoint, 10],
        [end, 10],
      ],
      start,
      end
    );

    expect(result.visibleHours).toBeCloseTo(3, 5);
    expect(result.visibleFraction).toBeCloseTo(0.75, 5);
    expect(result.exposurePercent).toBeCloseTo(60, 5);
    expect(result.level).toBe('strong');
  });
});
