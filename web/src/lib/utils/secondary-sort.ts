import type { ScoredObject, SecondarySortField } from '@/types';

interface SortFieldConfig {
  field: SecondarySortField;
  label: string;
  getValue: (obj: ScoredObject, fov: { width: number; height: number } | null) => number | null;
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
    getValue: obj => obj.visibility.imagingWindow?.qualityScore ?? null,
    direction: 'desc',
  },
  {
    field: 'frameFill',
    label: 'Frame Fill',
    getValue: (obj, fov) => calculateFrameFill(obj, fov),
    direction: 'desc',
  },
];

function calculateFrameFill(
  obj: ScoredObject,
  fov: { width: number; height: number } | null
): number | null {
  if (obj.category === 'planet' || obj.category === 'moon') return null;
  const size = obj.visibility.angularSizeArcmin;
  if (size <= 0 || !fov) return null;
  const minDim = Math.min(fov.width, fov.height);
  if (minDim <= 0) return null;
  return (size / minDim) * 100;
}

export function getSortFieldConfigs(): { field: SecondarySortField; label: string }[] {
  return SORT_FIELD_CONFIGS.map(c => ({ field: c.field, label: c.label }));
}

export function getSecondarySortComparator(
  field: SecondarySortField,
  fov: { width: number; height: number } | null
): (a: ScoredObject, b: ScoredObject) => number {
  const config = SORT_FIELD_CONFIGS.find(c => c.field === field);
  if (!config) return (a, b) => b.totalScore - a.totalScore;

  return (a, b) => {
    const valA = config.getValue(a, fov);
    const valB = config.getValue(b, fov);

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
