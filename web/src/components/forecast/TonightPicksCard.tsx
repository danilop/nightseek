import { Trophy, X } from 'lucide-react';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import type { ScoredObject, TonightPick } from '@/types';
import TargetSummary from './TargetSummary';

interface TonightPicksCardProps {
  picks: TonightPick[];
  onObjectSelect: (object: ScoredObject) => void;
  onDismiss: () => void;
  weatherAvailable?: boolean;
  accessibilityByObject?: ReadonlyMap<ScoredObject, TargetAccessibility>;
}

export default function TonightPicksCard({
  picks,
  onObjectSelect,
  onDismiss,
  accessibilityByObject,
  weatherAvailable = true,
}: TonightPicksCardProps) {
  if (picks.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-night-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="font-medium text-sm text-white">Category leaders</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hide category leaders"
          className="text-gray-500 transition-colors hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className={`grid gap-3 ${
          picks.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }`}
      >
        {picks.map(pick => (
          <PickItem
            key={pick.object.objectName}
            weatherAvailable={weatherAvailable}
            pick={pick}
            accessibility={accessibilityByObject?.get(pick.object)}
            onSelect={onObjectSelect}
          />
        ))}
      </div>
    </div>
  );
}

function PickItem({
  pick,
  onSelect,
  accessibility,
  weatherAvailable,
}: {
  pick: TonightPick;
  onSelect: (object: ScoredObject) => void;
  accessibility?: TargetAccessibility;
  weatherAvailable: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(pick.object)}
      className="rounded-xl bg-night-800/50 p-3 text-left hover:bg-night-700/50"
    >
      <p className="mb-2 text-amber-300 text-xs">{pick.categoryLabel}</p>
      <TargetSummary
        name={pick.object.visibility.commonName || pick.object.objectName}
        visibility={pick.object.visibility}
        category={pick.object.category}
        subtype={pick.object.subtype}
        totalScore={pick.object.totalScore}
        weatherAvailable={weatherAvailable}
        accessibility={accessibility}
      />
    </button>
  );
}
