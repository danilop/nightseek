import { describe, expect, it } from 'vitest';
import type { ImagingWindow } from '@/types';
import type { TargetAccessibility } from './horizon-profile';
import { getBestPhotoReadyWindow, intersectImagingAndAccessWindows } from './target-photo-windows';

const imagingWindow: ImagingWindow = {
  start: new Date('2025-07-16T22:00:00Z'),
  end: new Date('2025-07-17T01:00:00Z'),
  quality: 'good',
  qualityScore: 78,
  factors: { altitude: 70, airmass: 65, moonInterference: 95, cloudCover: 80 },
};

function accessibility(start: string, end: string): TargetAccessibility {
  const window = {
    start: new Date(start),
    end: new Date(end),
    durationMinutes: (new Date(end).getTime() - new Date(start).getTime()) / 60_000,
    bestTimeOverlapMinutes: 0,
  };
  return {
    isAccessible: true,
    windows: [window],
    bestWindow: window,
    accessibleMinutes: window.durationMinutes,
    bestWindowOverlapMinutes: 0,
    priorityScore: window.durationMinutes,
  };
}

describe('target photo windows', () => {
  it('clips a quality window to the user horizon interval', () => {
    const result = intersectImagingAndAccessWindows(
      [imagingWindow],
      accessibility('2025-07-16T23:00:00Z', '2025-07-17T00:30:00Z')
    );

    expect(result).toHaveLength(1);
    expect(result[0].start).toEqual(new Date('2025-07-16T23:00:00Z'));
    expect(result[0].end).toEqual(new Date('2025-07-17T00:30:00Z'));
    expect(result[0].durationMinutes).toBe(90);
  });

  it('returns no photo window when a directional obstruction blocks the quality interval', () => {
    const result = getBestPhotoReadyWindow(
      [imagingWindow],
      accessibility('2025-07-17T02:00:00Z', '2025-07-17T03:00:00Z')
    );

    expect(result).toBeNull();
  });

  it('rejects an obstruction-clipped fragment shorter than the useful minimum', () => {
    const result = getBestPhotoReadyWindow(
      [imagingWindow],
      accessibility('2025-07-17T00:40:01Z', '2025-07-17T01:00:00Z')
    );

    expect(result).toBeNull();
  });

  it('prefers quality before duration when several accessible windows overlap', () => {
    const excellent = {
      ...imagingWindow,
      start: new Date('2025-07-17T00:00:00Z'),
      end: new Date('2025-07-17T00:40:00Z'),
      quality: 'excellent' as const,
      qualityScore: 90,
    };
    const result = getBestPhotoReadyWindow(
      [imagingWindow, excellent],
      accessibility('2025-07-16T22:00:00Z', '2025-07-17T01:00:00Z')
    );

    expect(result?.quality).toBe('excellent');
    expect(result?.durationMinutes).toBe(40);
  });
});
