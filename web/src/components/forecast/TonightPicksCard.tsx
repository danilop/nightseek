import { Trophy, X } from 'lucide-react';
import { getRatingFromScore } from '@/lib/utils/rating';
import type { ScoredObject, TonightPick } from '@/types';

interface TonightPicksCardProps {
  picks: TonightPick[];
  onObjectSelect: (object: ScoredObject) => void;
  onDismiss: () => void;
}

export default function TonightPicksCard({
  picks,
  onObjectSelect,
  onDismiss,
}: TonightPicksCardProps) {
  if (picks.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-night-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <span className="font-medium text-sm text-white">Best For Tonight</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-gray-500 transition-colors hover:text-gray-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className={`grid gap-3 ${
          picks.length === 1
            ? 'grid-cols-1'
            : picks.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : picks.length === 3
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {picks.map(pick => (
          <PickItem key={pick.object.objectName} pick={pick} onSelect={onObjectSelect} />
        ))}
      </div>
    </div>
  );
}

function PickItem({
  pick,
  onSelect,
}: {
  pick: TonightPick;
  onSelect: (object: ScoredObject) => void;
}) {
  const rating = getRatingFromScore(pick.object.totalScore, 200);
  const displayName = pick.object.visibility.commonName || pick.object.objectName;

  return (
    <button
      type="button"
      onClick={() => onSelect(pick.object)}
      className="rounded-lg bg-night-800/50 p-3 text-left transition-colors hover:bg-night-700/50"
    >
      <div className="text-amber-400/80 text-xs">{pick.categoryLabel}</div>
      <div className="truncate font-medium text-white">{displayName}</div>
      <div className="truncate text-gray-400 text-xs">{pick.reason}</div>
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-xs ${rating.color}`}>{rating.starString}</span>
        {pick.keyStat && <span className="text-gray-500 text-xs">{pick.keyStat}</span>}
      </div>
    </button>
  );
}
