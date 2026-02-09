import { Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Card, CountBadge, ToggleChevron } from '@/components/ui/Card';
import { predictVariableStars, type VariableStarPrediction } from '@/lib/aavso/vsx';

interface VariableStarsCardProps {
  nightDate: Date;
}

export default function VariableStarsCard({ nightDate }: VariableStarsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const predictions = useMemo(() => predictVariableStars(nightDate), [nightDate]);

  // Filter to stars with notable phases or visible magnitudes
  const notablePredictions = predictions.filter(
    p =>
      p.isNearMaximum ||
      p.isNearMinimum ||
      (p.predictedMagnitude !== null && p.predictedMagnitude <= 6.0)
  );

  if (notablePredictions.length === 0) return null;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-night-800"
      >
        <div className="flex items-center gap-3">
          <Star className="h-5 w-5 text-yellow-400" />
          <h3 className="font-semibold text-white">Variable Stars</h3>
          <CountBadge count={notablePredictions.length} />
        </div>
        <ToggleChevron expanded={expanded} />
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-night-700 p-4">
          {notablePredictions.map(prediction => (
            <VariableStarItem key={prediction.star.name} prediction={prediction} />
          ))}
          <p className="mt-3 text-center text-xs text-gray-500">
            Brightness predictions based on known periods and epochs
          </p>
        </div>
      )}
    </Card>
  );
}

function VariableStarItem({ prediction }: { prediction: VariableStarPrediction }) {
  const { star, predictedMagnitude, phaseDescription, isNearMaximum, isNearMinimum } = prediction;

  const statusColor = isNearMaximum
    ? 'text-green-400'
    : isNearMinimum
      ? 'text-red-400'
      : 'text-gray-400';

  return (
    <div className="rounded-lg bg-night-800 p-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-white">{star.name}</span>
          <span className="ml-2 text-xs text-gray-500">{star.constellation}</span>
        </div>
        {predictedMagnitude !== null && (
          <span className="rounded bg-night-700 px-2 py-0.5 text-xs text-gray-400">
            mag ~{predictedMagnitude.toFixed(1)}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-xs ${statusColor}`}>{phaseDescription}</span>
        <span className="text-xs text-gray-500">{star.variabilityType}</span>
      </div>
      {prediction.nextNotableEvent && prediction.nextNotableEventTime && (
        <p className="mt-1 text-xs text-gray-500">
          Next: {prediction.nextNotableEvent} —{' '}
          {prediction.nextNotableEventTime.toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
