import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { formatSubtype } from '@/lib/utils/format-subtype';
import type { NightInfo, NightWeather, ScoredObject } from '@/types';
import ObjectCard from './ObjectCard';

interface CategorySectionProps {
  title: string;
  icon: string;
  objects: ScoredObject[];
  nightInfo: NightInfo;
  weather: NightWeather | null;
  defaultExpanded?: boolean;
  defaultShowCount?: number;
  showSubtypeInPreview?: boolean;
}

export default function CategorySection({
  title,
  icon,
  objects,
  nightInfo,
  weather,
  defaultExpanded = false,
  defaultShowCount = 3,
  showSubtypeInPreview = false,
}: CategorySectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);

  if (objects.length === 0) return null;

  const displayObjects = showAll ? objects : objects.slice(0, defaultShowCount);
  const hasMore = objects.length > defaultShowCount;

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      {/* Header - always clickable */}
      <button
        type="button"
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-night-800 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <h3 className="font-semibold text-white">{title}</h3>
          <span className="text-sm text-gray-400 bg-night-700 px-2 py-0.5 rounded-full">
            {objects.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!expanded && objects.length > 0 && (
            <span className="text-sm text-gray-500 hidden sm:block">
              Top:{' '}
              {objects
                .slice(0, 3)
                .map(o => {
                  const name = o.visibility.commonName || o.objectName;
                  if (showSubtypeInPreview && o.subtype) {
                    return `${name} (${formatSubtype(o.subtype)})`;
                  }
                  return name;
                })
                .join(', ')}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Content - collapsible */}
      {expanded && (
        <div className="border-t border-night-700">
          <div className="p-4">
            {/* Desktop Grid */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayObjects.map(obj => (
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
              {displayObjects.map(obj => (
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

          {/* Show more/less button */}
          {hasMore && (
            <div className="px-4 pb-4">
              <button
                type="button"
                className="w-full py-2 text-sm text-sky-400 hover:text-sky-300
                           hover:bg-night-800 rounded-lg transition-colors"
                onClick={e => {
                  e.stopPropagation();
                  setShowAll(!showAll);
                }}
              >
                {showAll ? `Show less` : `Show all ${objects.length} objects`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
