import { describe, expect, it } from 'vitest';
import { createMockObjectVisibility, createMockScoredObject } from '@/test/factories';
import { calculateMoonInterference } from '../scoring';
import { createDefaultHorizonProfile, evaluateTargetAccessibility } from './horizon-profile';
import { applyQuickFilters } from './quick-filters';
import { getTargetRating } from './rating';

const now = new Date('2026-11-03T20:00:00Z');
const end = new Date('2026-11-03T23:00:00Z');
const imaging = {
  start: now,
  end,
  quality: 'good' as const,
  qualityScore: 80,
  factors: { altitude: 70, airmass: 1.2, moonInterference: 5, cloudCover: 10 },
};
const target = createMockScoredObject({
  visibility: createMockObjectVisibility({
    imagingWindow: imaging,
    altitudeSamples: [
      [now, 60],
      [end, 60],
    ],
    azimuthSamples: [
      [now, 180],
      [end, 180],
    ],
  }),
});

describe('quick filters share target eligibility and ratings', () => {
  it('returns all objects when no filters are active', () => {
    const objects = [target];
    expect(applyQuickFilters(objects, [])).toBe(objects);
  });
  it('requires a remaining useful photo window, including the local horizon', () => {
    const profile = createDefaultHorizonProfile();
    const clear = evaluateTargetAccessibility(target.visibility, profile, null);
    const blocked = evaluateTargetAccessibility(
      target.visibility,
      { ...profile, sectors: profile.sectors.map(s => ({ ...s, minAltitude: 90 })) },
      null
    );
    expect(applyQuickFilters([target], ['hasImaging'], new Map([[target, clear]]), now)).toEqual([
      target,
    ]);
    expect(applyQuickFilters([target], ['hasImaging'], new Map([[target, blocked]]), now)).toEqual(
      []
    );
    expect(applyQuickFilters([target], ['hasImaging'], new Map([[target, clear]]), end)).toEqual(
      []
    );
  });
  it('uses Moon interference scoring, including the Moon below the horizon', () => {
    const moonDown = createMockScoredObject({
      scoreBreakdown: {
        ...target.scoreBreakdown,
        moonInterference: calculateMoonInterference(100, 10, 'dso', 'galaxy', -10),
      },
    });
    const moonUp = createMockScoredObject({
      scoreBreakdown: {
        ...target.scoreBreakdown,
        moonInterference: calculateMoonInterference(100, 10, 'dso', 'galaxy', 50),
      },
    });
    expect(applyQuickFilters([moonDown, moonUp], ['moonSafe'])).toEqual([moonDown]);
  });
  it('top-rated means the same four or five stars shown on cards', () => {
    const objects = [50, 100, 117, 118, 150, 200].map(totalScore =>
      createMockScoredObject({ totalScore })
    );
    expect(applyQuickFilters(objects, ['highRated'])).toEqual(
      objects.filter(o => getTargetRating(o.totalScore).stars >= 4)
    );
    expect(applyQuickFilters(objects, ['highRated']).map(o => o.totalScore)).toEqual([
      118, 150, 200,
    ]);
  });
  it('combines filters with AND', () => {
    const high = createMockScoredObject({ totalScore: 150 });
    const low = createMockScoredObject({
      totalScore: 150,
      visibility: createMockObjectVisibility({ maxAltitude: 30 }),
    });
    expect(applyQuickFilters([high, low], ['highRated', 'above45'])).toEqual([high]);
  });
});
