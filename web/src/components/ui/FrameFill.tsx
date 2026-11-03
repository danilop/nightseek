import { getEffectiveFOV } from '@/lib/telescopes';
import { getFramePresentation } from '@/lib/utils/target-presentation';
import { useApp } from '@/stores/AppContext';
import type { ObjectCategory, ObjectVisibility } from '@/types';

/** Same geometry and selected device as the diagram and suitability calculation. */
export default function FrameFill({
  visibility,
  category,
}: {
  visibility: Pick<ObjectVisibility, 'angularSizeArcmin' | 'minorAxisArcmin'>;
  category: ObjectCategory;
}) {
  const { state } = useApp();
  const fov = getEffectiveFOV(state.settings.telescope, state.settings.customFOV);
  const frame = getFramePresentation(
    visibility.angularSizeArcmin,
    visibility.minorAxisArcmin,
    category,
    fov
  );
  if (!frame || category !== 'dso') return null;
  const estimated = frame.geometry?.minorEstimated;
  return (
    <span
      data-testid="target-frame-fill"
      className={`inline-block max-w-full whitespace-normal rounded px-1.5 py-0.5 font-normal text-xs tabular-nums ${frame.warning ? 'bg-amber-400/10 text-amber-200' : 'bg-sky-400/10 text-sky-200'}`}
      title={`${frame.dimensions} · ${frame.label}${estimated ? ' · minor axis estimated for preview' : ''}. Approximate catalogue footprint; actual orientation and faint emission affect framing.`}
    >
      {frame.dimensions} · {frame.label}
    </span>
  );
}
