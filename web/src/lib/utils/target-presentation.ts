import { calculateFrameFillPercent, calculateMosaicPanels, getFrameGeometry } from '@/lib/scoring';
import type { ObjectCategory } from '@/types';

/** Labels and dimensions used by every frame preview. No separate size score. */
export function getFramePresentation(
  major: number,
  minor: number | undefined,
  category: ObjectCategory,
  fov: { width: number; height: number } | null
) {
  if (!fov || category === 'planet' || category === 'moon' || category === 'milky_way') return null;
  const geometry = getFrameGeometry(major, fov, minor);
  if (!geometry) return { label: 'Size unknown', geometry: null, percent: null, warning: true };
  const oversized = calculateMosaicPanels(major, fov, minor) !== null;
  const small = geometry.frameCoverage < 0.01;
  return {
    label: oversized ? 'Extends beyond frame' : small ? 'Small in frame' : 'Fits in frame',
    geometry,
    percent: calculateFrameFillPercent(major, category, fov, minor),
    warning: oversized || small,
  };
}
