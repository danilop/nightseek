import { describe, expect, it } from 'vitest';
import type { ScoredObject } from '@/types';
import { getSecondarySortComparator, getSortFieldConfigs, getSortLabel } from './secondary-sort';

function makeScoredObject(
  overrides: Omit<Partial<ScoredObject>, 'visibility'> & {
    visibility?: Partial<ScoredObject['visibility']>;
  } = {}
): ScoredObject {
  return {
    objectName: 'Test',
    category: 'dso',
    subtype: 'galaxy',
    totalScore: 80,
    scoreBreakdown: {} as ScoredObject['scoreBreakdown'],
    reason: '',
    magnitude: 10,
    ...overrides,
    visibility: {
      objectName: 'Test',
      objectType: 'dso',
      isVisible: true,
      maxAltitude: 60,
      maxAltitudeTime: new Date(),
      above45Start: null,
      above45End: null,
      above60Start: null,
      above60End: null,
      above75Start: null,
      above75End: null,
      moonSeparation: 50,
      moonWarning: false,
      magnitude: 10,
      isInterstellar: false,
      altitudeSamples: [],
      subtype: 'galaxy',
      angularSizeArcmin: 10,
      surfaceBrightness: null,
      raHours: 12,
      decDegrees: 30,
      commonName: '',
      minAirmass: 1.1,
      azimuthAtPeak: 180,
      apparentDiameterArcsec: null,
      apparentDiameterMin: null,
      apparentDiameterMax: null,
      positionAngle: null,
      imagingWindow: undefined,
      ...overrides.visibility,
    },
  } as ScoredObject;
}

describe('getSecondarySortComparator', () => {
  it('sorts by score descending (default)', () => {
    const a = makeScoredObject({ totalScore: 120 });
    const b = makeScoredObject({ totalScore: 80 });
    const cmp = getSecondarySortComparator('score', null);
    expect(cmp(a, b)).toBeLessThan(0); // a first (higher score)
  });

  it('sorts by magnitude ascending (brightest first)', () => {
    const bright = makeScoredObject({ magnitude: 2 });
    const faint = makeScoredObject({ magnitude: 12 });
    const cmp = getSecondarySortComparator('magnitude', null);
    expect(cmp(bright, faint)).toBeLessThan(0); // bright first
  });

  it('pushes null magnitude to end', () => {
    const withMag = makeScoredObject({ magnitude: 5 });
    const noMag = makeScoredObject({ magnitude: null });
    const cmp = getSecondarySortComparator('magnitude', null);
    expect(cmp(withMag, noMag)).toBeLessThan(0);
    expect(cmp(noMag, withMag)).toBeGreaterThan(0);
  });

  it('sorts by altitude descending', () => {
    const high = makeScoredObject({ visibility: { maxAltitude: 80 } });
    const low = makeScoredObject({ visibility: { maxAltitude: 30 } });
    const cmp = getSecondarySortComparator('altitude', null);
    expect(cmp(high, low)).toBeLessThan(0);
  });

  it('sorts by moonSep descending (farthest first)', () => {
    const far = makeScoredObject({ visibility: { moonSeparation: 90 } });
    const close = makeScoredObject({ visibility: { moonSeparation: 10 } });
    const cmp = getSecondarySortComparator('moonSep', null);
    expect(cmp(far, close)).toBeLessThan(0);
  });

  it('sorts by imaging quality descending', () => {
    const good = makeScoredObject({
      visibility: {
        imagingWindow: {
          start: new Date(),
          end: new Date(),
          quality: 'excellent',
          qualityScore: 90,
          factors: { altitude: 80, airmass: 1.1, moonInterference: 2, cloudCover: 5 },
        },
      },
    });
    const noImaging = makeScoredObject({});
    const cmp = getSecondarySortComparator('imaging', null);
    expect(cmp(good, noImaging)).toBeLessThan(0);
  });

  it('sorts by frameFill descending', () => {
    const large = makeScoredObject({ visibility: { angularSizeArcmin: 50 } });
    const small = makeScoredObject({ visibility: { angularSizeArcmin: 5 } });
    const fov = { width: 120, height: 80 };
    const cmp = getSecondarySortComparator('frameFill', fov);
    expect(cmp(large, small)).toBeLessThan(0);
  });

  it('returns 0 for frameFill when fov is null', () => {
    const a = makeScoredObject({ visibility: { angularSizeArcmin: 50 } });
    const b = makeScoredObject({ visibility: { angularSizeArcmin: 5 } });
    const cmp = getSecondarySortComparator('frameFill', null);
    // Both null → 0
    expect(cmp(a, b)).toBe(0);
  });
});

describe('getSortFieldConfigs', () => {
  it('returns all 6 sort options', () => {
    expect(getSortFieldConfigs()).toHaveLength(6);
  });
});

describe('getSortLabel', () => {
  it('returns correct labels', () => {
    expect(getSortLabel('score')).toBe('Score');
    expect(getSortLabel('magnitude')).toBe('Brightness');
    expect(getSortLabel('frameFill')).toBe('Frame Fill');
  });
});
