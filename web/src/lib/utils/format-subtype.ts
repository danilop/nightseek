import type { DSOSubtype } from '@/types';

/**
 * Display names for DSO subtypes
 * Centralized mapping ensures consistent formatting across the app
 */
const SUBTYPE_DISPLAY_NAMES: Record<DSOSubtype, string> = {
  galaxy: 'Galaxy',
  galaxy_pair: 'Galaxy Pair',
  galaxy_triplet: 'Galaxy Triplet',
  galaxy_group: 'Galaxy Group',
  emission_nebula: 'Emission Nebula',
  reflection_nebula: 'Reflection Nebula',
  planetary_nebula: 'Planetary Nebula',
  supernova_remnant: 'Supernova Remnant',
  nebula: 'Nebula',
  hii_region: 'HII Region',
  open_cluster: 'Open Cluster',
  globular_cluster: 'Globular Cluster',
  double_star: 'Double Star',
  asterism: 'Asterism',
  star_association: 'Star Association',
  dark_nebula: 'Dark Nebula',
  cluster_nebula: 'Cluster + Nebula',
  other: 'Other',
};

/**
 * Format a DSO subtype for display
 * Uses explicit mapping for known types, fallback for unknown
 */
export function formatSubtype(subtype: string): string {
  // Check explicit mapping first
  if (subtype in SUBTYPE_DISPLAY_NAMES) {
    return SUBTYPE_DISPLAY_NAMES[subtype as DSOSubtype];
  }

  // Fallback: replace underscores and capitalize words
  return subtype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
