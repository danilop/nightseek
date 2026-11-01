import { getEffectiveFOV } from '@/lib/telescopes';
import { formatFrameFillPercent } from '@/lib/utils/format';
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
      className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 font-normal text-xs tabular-nums ${frame.warning ? 'bg-amber-400/10 text-amber-200' : 'bg-sky-400/10 text-sky-200'}`}
      title={
        frame.percent === null
          ? 'Target size unavailable for the selected device'
          : `Estimated target area / selected camera field area · ${frame.label}${estimated ? ' · minor axis estimated' : ''}. Values above 100% mean the target is larger than the frame; shape can cause cropping even below 100%.`
      }
    >
      FoV{' '}
      {frame.percent === null
        ? 'unknown'
        : `${estimated ? '≈' : ''}${formatFrameFillPercent(frame.percent)}`}
    </span>
  );
}
