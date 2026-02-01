import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { useUIState } from '@/hooks/useUIState';
import { formatSubtype } from '@/lib/utils/format-subtype';
import type { NightInfo, NightWeather, ScoredObject } from '@/types';
import ObjectCard from './ObjectCard';

interface CategorySectionProps {
  categoryKey: string;
  title: string;
  icon: string;
  objects: ScoredObject[];
  nightInfo: NightInfo;
  weather: NightWeather | null;
  defaultExpanded?: boolean;
  defaultShowCount?: number;
  showSubtypeInPreview?: boolean;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  onObjectClick?: (object: ScoredObject) => void;
}

const CategorySection = forwardRef<HTMLDivElement, CategorySectionProps>(function CategorySection(
  {
    categoryKey,
    title,
    icon,
    objects,
    nightInfo,
    weather,
    defaultExpanded = false,
    defaultShowCount = 3,
    showSubtypeInPreview = false,
    isDragging = false,
    dragHandleProps,
    onObjectClick,
  },
  ref
) {
  const { isCategoryExpanded, toggleCategoryExpanded } = useUIState();
  const expanded = isCategoryExpanded(categoryKey, defaultExpanded);
  const [showAll, setShowAll] = useState(false);

  if (objects.length === 0) return null;

  const displayObjects = showAll ? objects : objects.slice(0, defaultShowCount);
  const hasMore = objects.length > defaultShowCount;

  return (
    <div
      ref={ref}
      className={`bg-night-900 rounded-xl border border-night-700 overflow-hidden transition-shadow ${
        isDragging ? 'shadow-lg shadow-sky-500/20 ring-2 ring-sky-500/50' : ''
      }`}
    >
      {/* Header - always clickable */}
      <div className="flex items-center">
        {/* Drag handle */}
        {dragHandleProps && (
          <button
            type="button"
            className="px-2 py-3 text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
            {...dragHandleProps}
          >
            <GripVertical className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          className={`flex-1 ${dragHandleProps ? 'pl-0' : 'pl-4'} pr-4 py-3 flex items-center justify-between hover:bg-night-800 transition-colors`}
          onClick={() => toggleCategoryExpanded(categoryKey)}
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
      </div>

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
                  onDSOClick={onObjectClick}
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
                  onDSOClick={onObjectClick}
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
});

export default CategorySection;
