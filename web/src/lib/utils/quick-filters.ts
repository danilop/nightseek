import type { QuickFilterId, ScoredObject } from '@/types';
import type { TargetAccessibility } from './horizon-profile';
import { isTopRatedTarget } from './rating';
import { getTargetPhotoWindow } from './target-photo-windows';

export function applyQuickFilters(
  objects: ScoredObject[],
  activeFilters: QuickFilterId[],
  accessibility?: ReadonlyMap<ScoredObject, TargetAccessibility>,
  now: Date = new Date()
): ScoredObject[] {
  if (activeFilters.length === 0) return objects;
  return objects.filter(object =>
    activeFilters.every(filter => {
      switch (filter) {
        case 'hasImaging':
          return getTargetPhotoWindow(object.visibility, accessibility?.get(object), now) !== null;
        case 'moonSafe':
          return object.scoreBreakdown.moonInterference >= 24;
        case 'above45':
          return object.visibility.maxAltitude >= 45;
        case 'highRated':
          return isTopRatedTarget(object);
        default:
          return true;
      }
    })
  );
}
