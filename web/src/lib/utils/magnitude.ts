import type { ObjectCategory } from '@/types';

export function hasMagnitude(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** null means no user filter. Every active limit excludes unknown brightness. */
export function matchesMagnitudeLimit(
  value: number | null | undefined,
  limit: number | null
): boolean {
  return limit === null || (hasMagnitude(value) && value <= limit);
}

export function isMagnitudeEstimate(category: ObjectCategory): boolean {
  return ['comet', 'asteroid', 'dwarf_planet', 'planet', 'moon'].includes(category);
}
