import FrameFill from '@/components/ui/FrameFill';
import Magnitude from '@/components/ui/Magnitude';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { getEffectiveFOV } from '@/lib/telescopes';
import { formatAltitude, getCategoryIcon } from '@/lib/utils/format';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import { isMagnitudeEstimate } from '@/lib/utils/magnitude';
import { getTargetRating } from '@/lib/utils/rating';
import { getTargetPhotoWindow } from '@/lib/utils/target-photo-windows';
import { useApp } from '@/stores/AppContext';
import type { ObjectCategory, ObjectVisibility } from '@/types';
import ImagingWindowSummary from './ImagingWindowSummary';
import TargetFrameDiagram from './TargetFrameDiagram';

/** Shared, non-interactive content for cards, picks, session plans and search. */
export default function TargetSummary({
  name,
  magnitude,
  visibility,
  category,
  subtype,
  totalScore,
  accessibility,
  timezone,
  currentAltitude,
  weatherAvailable = true,
}: {
  name: string;
  magnitude: number | null;
  visibility: ObjectVisibility;
  category: ObjectCategory;
  subtype?: string | null;
  totalScore?: number;
  accessibility?: TargetAccessibility;
  timezone?: string;
  currentAltitude?: number | null;
  weatherAvailable?: boolean;
}) {
  const { state } = useApp();
  const now = useCurrentTime();
  const fov = getEffectiveFOV(state.settings.telescope, state.settings.customFOV);
  const window = getTargetPhotoWindow(visibility, accessibility, now);
  const rating = totalScore === undefined ? null : getTargetRating(totalScore);
  const zone = timezone ?? state.location?.timezone;
  return (
    <div className="flex items-start gap-3" data-testid="target-summary">
      {category === 'dso' && fov ? (
        <TargetFrameDiagram
          major={visibility.angularSizeArcmin}
          minor={visibility.minorAxisArcmin}
          category={category}
          fov={fov}
          compact
        />
      ) : (
        <span aria-hidden="true" className="pt-1 text-2xl">
          {getCategoryIcon(category, subtype)}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h4 className="break-words font-semibold text-white">{name}</h4>
          <Magnitude
            value={magnitude}
            estimated={isMagnitudeEstimate(category)}
            source={visibility.magnitudeSource}
          />
          <FrameFill visibility={visibility} category={category} />
        </div>
        {rating && (
          <p className="flex flex-wrap items-center gap-x-2 text-xs">
            <span
              role="img"
              className={rating.color}
              aria-label={`Target suitability: ${rating.stars} out of 5`}
            >
              {rating.starString}
            </span>
            <span className="text-gray-400">Target suitability</span>
          </p>
        )}
        <p className="text-gray-300 text-xs">
          {currentAltitude == null
            ? `Peak ${formatAltitude(visibility.maxAltitude)}`
            : currentAltitude <= 0
              ? 'Below horizon now'
              : `${formatAltitude(currentAltitude)} now`}
          {visibility.moonWarning && <span className="text-amber-300"> · Moon interference</span>}
        </p>
        <ImagingWindowSummary window={window} weatherAvailable={weatherAvailable} timezone={zone} />
      </div>
    </div>
  );
}
