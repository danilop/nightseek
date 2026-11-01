import { describe, expect, it } from 'vitest';
import { compareTargetScores } from '@/lib/scoring';
import {
  createDefaultHorizonProfile,
  evaluateTargetAccessibility,
} from '@/lib/utils/horizon-profile';
import { getSecondarySortComparator } from '@/lib/utils/secondary-sort';
import { selectTonightPicks } from '@/lib/utils/tonight-picks';
import { createMockObjectVisibility, createMockScoredObject } from '@/test/factories';
import { planSessionTargets } from './session';

const start = new Date('2026-11-03T21:00:00Z');
const profile = { ...createDefaultHorizonProfile(), minimumAltitude: 30 };

function galaxy(name: string, score: number, hours: number, altitude = 60) {
  const end = new Date(start.getTime() + hours * 3_600_000);
  return createMockScoredObject({
    objectName: name,
    category: 'dso',
    subtype: 'galaxy',
    totalScore: score,
    visibility: createMockObjectVisibility({
      objectName: name,
      altitudeSamples: [
        [start, altitude],
        [end, altitude],
      ],
      azimuthSamples: [
        [start, 180],
        [end, 180],
      ],
      imagingWindow: {
        start,
        end,
        quality: 'good',
        qualityScore: 80,
        factors: { altitude, airmass: 1.2, moonInterference: 0, cloudCover: 0 },
      },
    }),
  });
}

describe('one target ranking across recommendations', () => {
  it('keeps M31 ahead of lower-scoring galaxies with longer access windows', () => {
    const m31 = galaxy('M31', 180, 3);
    const small = galaxy('NGC-small', 120, 9);
    const objects = [small, m31];
    expect(
      evaluateTargetAccessibility(small.visibility, profile, null).accessibleMinutes
    ).toBeGreaterThan(evaluateTargetAccessibility(m31.visibility, profile, null).accessibleMinutes);
    expect([...objects].sort(compareTargetScores)[0]).toBe(m31);
    expect([...objects].sort(getSecondarySortComparator('score', null))[0]).toBe(m31);
    expect(selectTonightPicks(objects)[0].object).toBe(m31);
    expect(planSessionTargets(objects, profile, null, start)[0].object).toBe(m31);
  });

  it('uses the same tie order regardless of input order or window length', () => {
    const objects = [galaxy('M33', 150, 9), galaxy('M31', 150, 3)];
    expect(
      [...objects].sort(getSecondarySortComparator('score', null)).map(o => o.objectName)
    ).toEqual(['M31', 'M33']);
    expect(selectTonightPicks(objects)[0].object.objectName).toBe('M31');
    expect(planSessionTargets(objects, profile, null, start).map(p => p.object.objectName)).toEqual(
      ['M31', 'M33']
    );
  });

  it('does not recommend a blocked or elapsed target just because its score is high', () => {
    const blocked = galaxy('Blocked', 200, 9, 10);
    const elapsed = galaxy('Elapsed', 190, 1);
    const available = galaxy('M31', 180, 3);
    const plans = planSessionTargets(
      [blocked, elapsed, available],
      profile,
      null,
      new Date('2026-11-03T22:00:00Z')
    );
    expect(plans.map(p => p.object.objectName)).toEqual(['M31']);
  });
});
