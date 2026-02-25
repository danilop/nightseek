import { describe, expect, it } from 'vitest';
import type { ScoredObject } from '@/types';
import { selectTonightPicks } from './tonight-picks';

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
    reason: 'Good target',
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

describe('selectTonightPicks', () => {
  it('returns empty array when no objects qualify', () => {
    const objects = [makeScoredObject({ totalScore: 40 })];
    expect(selectTonightPicks(objects)).toHaveLength(0);
  });

  it('picks top planet when score >= 60', () => {
    const planet = makeScoredObject({
      objectName: 'Jupiter',
      category: 'planet',
      totalScore: 120,
      magnitude: -2.5,
    });
    const picks = selectTonightPicks([planet]);
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Planet');
    expect(picks[0].object.objectName).toBe('Jupiter');
  });

  it('picks top DSO when score >= 60', () => {
    const dso = makeScoredObject({
      objectName: 'M42',
      category: 'dso',
      totalScore: 90,
    });
    const picks = selectTonightPicks([dso]);
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Deep Sky');
  });

  it('picks top comet only when score >= 80', () => {
    const weakComet = makeScoredObject({
      objectName: 'C/2024 A1',
      category: 'comet',
      totalScore: 70,
    });
    expect(selectTonightPicks([weakComet])).toHaveLength(0);

    const strongComet = makeScoredObject({
      objectName: 'C/2024 B2',
      category: 'comet',
      totalScore: 100,
    });
    const picks = selectTonightPicks([strongComet]);
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Comet');
  });

  it('picks best imaging when qualityScore >= 70 and not already picked', () => {
    const dso = makeScoredObject({
      objectName: 'M31',
      category: 'dso',
      totalScore: 90,
      visibility: {
        imagingWindow: {
          start: new Date(),
          end: new Date(),
          quality: 'excellent',
          qualityScore: 85,
          factors: { altitude: 80, airmass: 1.1, moonInterference: 2, cloudCover: 5 },
        },
      },
    });
    const imagingOnly = makeScoredObject({
      objectName: 'NGC 7000',
      category: 'dso',
      totalScore: 50,
      visibility: {
        imagingWindow: {
          start: new Date(),
          end: new Date(),
          quality: 'good',
          qualityScore: 75,
          factors: { altitude: 60, airmass: 1.3, moonInterference: 5, cloudCover: 10 },
        },
      },
    });
    const picks = selectTonightPicks([dso, imagingOnly]);
    expect(picks).toHaveLength(2);
    expect(picks[0].categoryLabel).toBe('Top Deep Sky');
    expect(picks[1].categoryLabel).toBe('Best Imaging');
    expect(picks[1].object.objectName).toBe('NGC 7000');
  });

  it('deduplicates: skips best imaging if already top DSO', () => {
    const dso = makeScoredObject({
      objectName: 'M42',
      category: 'dso',
      totalScore: 100,
      visibility: {
        imagingWindow: {
          start: new Date(),
          end: new Date(),
          quality: 'excellent',
          qualityScore: 95,
          factors: { altitude: 80, airmass: 1.1, moonInterference: 2, cloudCover: 5 },
        },
      },
    });
    const picks = selectTonightPicks([dso]);
    // Only Top Deep Sky, not Best Imaging (same object)
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Deep Sky');
  });

  it('returns up to 4 picks when all categories qualify', () => {
    const planet = makeScoredObject({ objectName: 'Saturn', category: 'planet', totalScore: 100 });
    const dso = makeScoredObject({ objectName: 'M31', category: 'dso', totalScore: 90 });
    const comet = makeScoredObject({ objectName: 'C/2024', category: 'comet', totalScore: 85 });
    const imaging = makeScoredObject({
      objectName: 'NGC 1499',
      category: 'dso',
      totalScore: 50,
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
    const picks = selectTonightPicks([planet, dso, comet, imaging]);
    expect(picks).toHaveLength(4);
    expect(picks.map(p => p.categoryLabel)).toEqual([
      'Top Planet',
      'Top Deep Sky',
      'Top Comet',
      'Best Imaging',
    ]);
  });
});
