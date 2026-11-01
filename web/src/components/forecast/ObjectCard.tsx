import { getAltitudeAtTime } from '@/lib/utils/altitude-interpolation';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import type { NightInfo, NightWeather, ScoredObject } from '@/types';
import type { SortMode } from './SortModeControl';
import TargetSummary from './TargetSummary';

interface ObjectCardProps {
  object: ScoredObject;
  nightInfo: NightInfo;
  weather: NightWeather | null;
  compact?: boolean;
  sortMode?: SortMode;
  selectedTime?: Date;
  targetAccessibility?: TargetAccessibility;
  onDSOClick?: (object: ScoredObject) => void;
  onSelect?: (object: ScoredObject) => void;
}
export default function ObjectCard({
  object,
  weather,
  sortMode,
  selectedTime,
  targetAccessibility,
  onDSOClick,
  onSelect,
}: ObjectCardProps) {
  const select = onSelect ?? (object.category === 'dso' ? onDSOClick : undefined);
  return (
    <button
      type="button"
      data-testid="object-card"
      onClick={() => select?.(object)}
      className="card-hover w-full rounded-xl border border-white/5 bg-night-800 p-3 text-left focus-visible:outline-2 focus-visible:outline-sky-400"
    >
      <TargetSummary
        name={object.visibility.commonName || object.objectName}
        visibility={object.visibility}
        category={object.category}
        subtype={object.subtype}
        totalScore={object.totalScore}
        accessibility={targetAccessibility}
        weatherAvailable={weather !== null}
        currentAltitude={
          sortMode === 'altitude' && selectedTime
            ? getAltitudeAtTime(object.visibility.altitudeSamples, selectedTime)
            : null
        }
      />
    </button>
  );
}
