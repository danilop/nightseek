import type { QuickFilterId, ScoredObject } from '@/types';

interface QuickFilterConfig {
  id: QuickFilterId;
  predicate: (obj: ScoredObject) => boolean;
}

const QUICK_FILTER_CONFIGS: QuickFilterConfig[] = [
  {
    id: 'hasImaging',
    predicate: obj => obj.visibility.imagingWindow != null,
  },
  {
    id: 'moonSafe',
    predicate: obj => obj.visibility.moonSeparation === null || obj.visibility.moonSeparation > 30,
  },
  {
    id: 'above45',
    predicate: obj => obj.visibility.maxAltitude >= 45,
  },
  {
    id: 'highRated',
    predicate: obj => obj.totalScore >= 100,
  },
];

export function applyQuickFilters(
  objects: ScoredObject[],
  activeFilters: QuickFilterId[]
): ScoredObject[] {
  if (activeFilters.length === 0) return objects;

  const predicates = activeFilters
    .map(id => QUICK_FILTER_CONFIGS.find(c => c.id === id)?.predicate)
    .filter((p): p is QuickFilterConfig['predicate'] => p != null);

  return objects.filter(obj => predicates.every(p => p(obj)));
}
