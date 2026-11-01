import { describe, expect, it } from 'vitest';
import { createMockScoredObject } from '@/test/factories';
import { getTargetCategory } from './target-category';
import { selectTonightPicks } from './tonight-picks';

describe('shared target categories', () => {
  it('classifies cluster nebulae once, consistently with tonight picks', () => {
    const target = createMockScoredObject({
      category: 'dso',
      subtype: 'cluster_nebula',
      totalScore: 150,
    });
    expect(getTargetCategory(target)).toBe('nebulae');
    const picks = selectTonightPicks([target]);
    expect(picks).toHaveLength(1);
    expect(picks[0].categoryLabel).toBe('Top Nebula');
  });
  it.each([
    ['galaxy_pair', 'galaxies'],
    ['hii_region', 'nebulae'],
    ['dark_nebula', 'nebulae'],
    ['open_cluster', 'clusters'],
    ['globular_cluster', 'clusters'],
    [null, 'other'],
  ] as const)('maps %s to %s', (subtype, category) => {
    expect(getTargetCategory({ category: 'dso', subtype })).toBe(category);
  });
});
