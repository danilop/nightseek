import type { ScoredObject, SecondarySortField } from '@/types';
import { calculateFrameFillPercent, compareTargetScores } from '../scoring';
import type { TargetAccessibility } from './horizon-profile';
import { getTargetPhotoWindow } from './target-photo-windows';

interface SortFieldConfig {
  field: SecondarySortField;
  label: string;
  getValue: (
    obj: ScoredObject,
    fov: { width: number; height: number } | null,
    access?: TargetAccessibility,
    now?: Date
  ) => number | null;
  direction: 'desc' | 'asc';
}

const SORT_FIELD_CONFIGS: SortFieldConfig[] = [
  {
    field: 'score',
    label: 'Score',
    getValue: obj => obj.totalScore,
    direction: 'desc',
  },
  {
    field: 'magnitude',
    label: 'Brightness',
    getValue: obj => obj.magnitude,
    direction: 'asc', // lowest mag = brightest
  },
  {
    field: 'altitude',
    label: 'Peak Altitude',
    getValue: obj => obj.visibility.maxAltitude,
    direction: 'desc',
  },
  {
    field: 'moonSep',
    label: 'Moon Distance',
    getValue: obj => obj.visibility.moonSeparation,
    direction: 'desc',
  },
  {
    field: 'imaging',
    label: 'Imaging Quality',
    getValue: (obj, _fov, access, now) =>
      getTargetPhotoWindow(obj.visibility, access, now)?.qualityScore ?? null,
    direction: 'desc',
  },
  {
    field: 'frameFill',
    label: 'Frame Area',
    getValue: (obj, fov) => calculateFrameFill(obj, fov),
    direction: 'desc',
  },
];

function calculateFrameFill(
  obj: ScoredObject,
  fov: { width: number; height: number } | null
): number | null {
  return calculateFrameFillPercent(
    obj.visibility.angularSizeArcmin,
    obj.category,
    fov,
    obj.visibility.minorAxisArcmin
  );
}

export function getSortFieldConfigs(): { field: SecondarySortField; label: string }[] {
  return SORT_FIELD_CONFIGS.map(c => ({ field: c.field, label: c.label }));
}

export function getSecondarySortComparator(
  field: SecondarySortField,
  fov: { width: number; height: number } | null,
  accessibility?: ReadonlyMap<ScoredObject, TargetAccessibility>,
  now: Date = new Date()
): (a: ScoredObject, b: ScoredObject) => number {
  const config = SORT_FIELD_CONFIGS.find(c => c.field === field);
  if (!config || field === 'score') return compareTargetScores;

  return (a, b) => {
    const valA = config.getValue(a, fov, accessibility?.get(a), now);
    const valB = config.getValue(b, fov, accessibility?.get(b), now);

    // Null → end
    if (valA === null && valB === null) return 0;
    if (valA === null) return 1;
    if (valB === null) return -1;

    return config.direction === 'desc' ? valB - valA : valA - valB;
  };
}

export function getSortLabel(field: SecondarySortField): string {
  return SORT_FIELD_CONFIGS.find(c => c.field === field)?.label ?? 'Score';
}
