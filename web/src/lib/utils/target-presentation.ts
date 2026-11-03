import { calculateFrameFillPercent, calculateMosaicPanels, getFrameGeometry } from '@/lib/scoring';
import type { ObjectCategory } from '@/types';
import { formatAngularSize } from './format';

// Keep extended-target axes in arcminutes, matching the catalogue evidence.
function formatAxis(arcmin: number) {
  return arcmin >= 1 ? `${Number(arcmin.toFixed(2))}′` : formatAngularSize(arcmin);
}

/** Labels and dimensions used by every frame preview. No separate size score. */
export function getFramePresentation(
  major: number,
  minor: number | undefined,
  category: ObjectCategory,
  fov: { width: number; height: number } | null
) {
  if (!fov || category === 'planet' || category === 'moon' || category === 'milky_way') return null;
  const geometry = getFrameGeometry(major, fov, minor);
  if (!geometry)
    return {
      label: 'Size unknown',
      dimensions: 'FoV unknown',
      geometry: null,
      percent: null,
      warning: true,
    };
  const oversized = calculateMosaicPanels(major, fov, minor) !== null;
  const small = geometry.spanFraction < 0.1;
  return {
    label: oversized ? 'Extends beyond frame' : small ? 'Small in frame' : 'Fits in frame',
    dimensions: `${formatAxis(geometry.major)}${geometry.minorEstimated ? ' · width unknown' : ` × ${formatAxis(geometry.minor)}`}`,
    geometry,
    percent: calculateFrameFillPercent(major, category, fov, minor),
    warning: oversized || small,
  };
}
