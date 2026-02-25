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

  it('picks top galaxy when score >= 60', () => {
    const galaxy = makeScoredObject({
      objectName: 'M31',
      category: 'dso',
      subtype: 'galaxy',
      totalScore: 90,
    });
    const picks = selectTonightPicks([galaxy]);
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Galaxy');
  });

  it('picks top nebula when score >= 60', () => {
    const nebula = makeScoredObject({
      objectName: 'M42',
      category: 'dso',
      subtype: 'emission_nebula',
      totalScore: 90,
      visibility: { subtype: 'emission_nebula' },
    });
    const picks = selectTonightPicks([nebula]);
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Nebula');
  });

  it('picks top cluster when score >= 60', () => {
    const cluster = makeScoredObject({
      objectName: 'M45',
      category: 'dso',
      subtype: 'open_cluster',
      totalScore: 85,
      visibility: { subtype: 'open_cluster' },
    });
    const picks = selectTonightPicks([cluster]);
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Cluster');
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

  it('deduplicates across categories', () => {
    const galaxy = makeScoredObject({
      objectName: 'M31',
      category: 'dso',
      subtype: 'galaxy',
      totalScore: 100,
    });
    const picks = selectTonightPicks([galaxy]);
    // Only Top Galaxy — no duplicates
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Galaxy');
  });

  it('returns per-category picks when all DSO categories qualify', () => {
    const planet = makeScoredObject({ objectName: 'Saturn', category: 'planet', totalScore: 100 });
    const galaxy = makeScoredObject({
      objectName: 'M31',
      category: 'dso',
      subtype: 'galaxy',
      totalScore: 90,
    });
    const nebula = makeScoredObject({
      objectName: 'M42',
      category: 'dso',
      subtype: 'emission_nebula',
      totalScore: 85,
      visibility: { subtype: 'emission_nebula' },
    });
    const cluster = makeScoredObject({
      objectName: 'M45',
      category: 'dso',
      subtype: 'open_cluster',
      totalScore: 80,
      visibility: { subtype: 'open_cluster' },
    });
    const comet = makeScoredObject({ objectName: 'C/2024', category: 'comet', totalScore: 85 });
    const picks = selectTonightPicks([planet, galaxy, nebula, cluster, comet]);
    expect(picks).toHaveLength(5);
    expect(picks.map(p => p.categoryLabel)).toEqual([
      'Top Planet',
      'Top Galaxy',
      'Top Nebula',
      'Top Cluster',
      'Top Comet',
    ]);
  });
});
