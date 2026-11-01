import { describe, expect, it } from 'vitest';
import { createMockObjectVisibility } from '@/test/factories';
import type { ImagingWindow } from '@/types';
import type { TargetAccessibility } from './horizon-profile';
import {
  getBestPhotoReadyWindow,
  getTargetPhotoWindow,
  intersectImagingAndAccessWindows,
} from './target-photo-windows';

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

describe('photo window selection after horizon and elapsed-time restrictions', () => {
  it('keeps a later candidate when the highest quality candidate is blocked or elapsed', () => {
    const later = {
      ...imagingWindow,
      start: new Date('2025-07-17T02:00:00Z'),
      end: new Date('2025-07-17T04:00:00Z'),
      qualityScore: 65,
    };
    const visibility = createMockObjectVisibility({
      imagingWindow,
      imagingWindows: [imagingWindow, later],
    });
    const access = accessibility('2025-07-17T02:00:00Z', '2025-07-17T04:00:00Z');
    expect(
      getTargetPhotoWindow(visibility, access, new Date('2025-07-16T21:00:00Z'))?.start
    ).toEqual(later.start);
    expect(
      getTargetPhotoWindow(visibility, undefined, new Date('2025-07-17T02:15:00Z'))?.durationMinutes
    ).toBe(105);
    expect(getTargetPhotoWindow(visibility, access, new Date('2025-07-17T03:31:00Z'))).toBeNull();
  });
});

it('reranks a horizon-clipped window using the actual remaining samples', () => {
  const start = new Date('2025-07-16T22:00Z');
  const at = (minutes: number) => new Date(Number(start) + minutes * 60_000);
  const original: ImagingWindow = {
    ...imagingWindow,
    start,
    end: at(180),
    qualityScore: 90,
    samples: [
      { time: at(0), score: 100, factors: imagingWindow.factors },
      { time: at(120), score: 60, factors: imagingWindow.factors },
      { time: at(180), score: 50, factors: imagingWindow.factors },
    ],
  };
  const alternative = { ...imagingWindow, start: at(120), end: at(180), qualityScore: 75 };
  const access = accessibility(at(120).toISOString(), at(180).toISOString());
  const windows = intersectImagingAndAccessWindows([original, alternative], access);
  expect(windows.map(w => w.qualityScore)).toEqual([75, 55]);
  expect(windows[1].quality).toBe('acceptable');
  const visibility = createMockObjectVisibility({ imagingWindows: [original, alternative] });
  expect(getTargetPhotoWindow(visibility, undefined, at(120))?.qualityScore).toBe(75);
});
