
import { Sparkles } from 'lucide-react';
import type { ScoredObject, NightInfo, NightWeather } from '@/types';
import ObjectCard from './ObjectCard';

interface TonightHighlightsProps {
  objects: ScoredObject[];
  nightInfo: NightInfo;
  weather: NightWeather | null;
}

export default function TonightHighlights({
  objects,
  nightInfo,
  weather,
}: TonightHighlightsProps) {
  if (objects.length === 0) {
    return (
      <div className="bg-night-900 rounded-xl border border-night-700 p-6 text-center">
        <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No objects meet the visibility criteria for this night.</p>
        <p className="text-sm text-gray-500 mt-1">
          Try adjusting the magnitude limit in settings.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-night-700 flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          Tonight's Best Targets
        </h3>
        <span className="text-sm text-gray-400">
          {objects.length} object{objects.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-4">
        {/* Desktop Grid */}
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {objects.map((obj) => (
            <ObjectCard
              key={obj.objectName}
              object={obj}
              nightInfo={nightInfo}
              weather={weather}
            />
          ))}
        </div>

        {/* Mobile List */}
        <div className="sm:hidden space-y-3">
          {objects.map((obj) => (
            <ObjectCard
              key={obj.objectName}
              object={obj}
              nightInfo={nightInfo}
              weather={weather}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  );
}
