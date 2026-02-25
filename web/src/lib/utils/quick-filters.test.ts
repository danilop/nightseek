import { describe, expect, it } from 'vitest';
import type { ScoredObject } from '@/types';
import { applyQuickFilters } from './quick-filters';

function makeScoredObject(
  overrides: Omit<Partial<ScoredObject>, 'visibility'> & {
    visibility?: Partial<ScoredObject['visibility']>;
  } = {}
): ScoredObject {
  return {
    objectName: 'Test Object',
    category: 'dso',
    subtype: 'galaxy',
    totalScore: 80,
    scoreBreakdown: {} as ScoredObject['scoreBreakdown'],
    reason: 'Good target',
    magnitude: 10,
    ...overrides,
    visibility: {
      objectName: 'Test Object',
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
      commonName: 'Test',
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

describe('applyQuickFilters', () => {
  it('returns all objects when no filters active', () => {
    const objects = [makeScoredObject({}), makeScoredObject({})];
    expect(applyQuickFilters(objects, [])).toHaveLength(2);
  });

  it('filters by hasImaging', () => {
    const withImaging = makeScoredObject({
      visibility: {
        imagingWindow: {
          start: new Date(),
          end: new Date(),
          quality: 'good',
          qualityScore: 80,
          factors: { altitude: 70, airmass: 1.2, moonInterference: 5, cloudCover: 10 },
        },
      },
    });
    const withoutImaging = makeScoredObject({});
    const result = applyQuickFilters([withImaging, withoutImaging], ['hasImaging']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(withImaging);
  });

  it('filters by moonSafe (passes null moonSep)', () => {
    const moonNull = makeScoredObject({ visibility: { moonSeparation: null } });
    const moonFar = makeScoredObject({ visibility: { moonSeparation: 60 } });
    const moonClose = makeScoredObject({ visibility: { moonSeparation: 20 } });
    const result = applyQuickFilters([moonNull, moonFar, moonClose], ['moonSafe']);
    expect(result).toHaveLength(2);
  });

  it('filters by above45', () => {
    const high = makeScoredObject({ visibility: { maxAltitude: 70 } });
    const low = makeScoredObject({ visibility: { maxAltitude: 30 } });
    const result = applyQuickFilters([high, low], ['above45']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(high);
  });

  it('filters by highRated', () => {
    const highScore = makeScoredObject({ totalScore: 150 });
    const lowScore = makeScoredObject({ totalScore: 50 });
    const result = applyQuickFilters([highScore, lowScore], ['highRated']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(highScore);
  });

  it('applies multiple filters as AND', () => {
    const goodObj = makeScoredObject({
      totalScore: 120,
      visibility: { maxAltitude: 60 },
    });
    const highOnly = makeScoredObject({
      totalScore: 120,
      visibility: { maxAltitude: 30 },
    });
    const result = applyQuickFilters([goodObj, highOnly], ['above45', 'highRated']);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(goodObj);
  });
});
