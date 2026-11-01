import type { ScoredObject } from '@/types';

/** Each target has exactly one category across summaries, picks and target lists. */
export function getTargetCategory(object: Pick<ScoredObject, 'category' | 'subtype'>): string {
  switch (object.category) {
    case 'planet':
      return 'planets';
    case 'comet':
      return 'comets';
    case 'dwarf_planet':
    case 'asteroid':
      return 'minor_planets';
    case 'milky_way':
      return 'milky_way';
    case 'dso':
      switch (object.subtype) {
        case 'galaxy':
        case 'galaxy_pair':
        case 'galaxy_triplet':
        case 'galaxy_group':
          return 'galaxies';
        case 'emission_nebula':
        case 'reflection_nebula':
        case 'planetary_nebula':
        case 'supernova_remnant':
        case 'nebula':
        case 'hii_region':
        case 'dark_nebula':
        case 'cluster_nebula':
          return 'nebulae';
        case 'open_cluster':
        case 'globular_cluster':
          return 'clusters';
      }
  }
  return 'other';
}
