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
      className={`overflow-hidden rounded-xl border border-night-700 bg-night-900 transition-shadow ${
        isDragging ? 'shadow-lg shadow-sky-500/20 ring-2 ring-sky-500/50' : ''
      }`}
    >
      {/* Header - always clickable */}
      <div className="flex items-center">
        {/* Drag handle */}
        {dragHandleProps && (
          <button
            type="button"
            className="cursor-grab touch-none px-2 py-3 text-gray-500 hover:text-gray-300 active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          className={`flex-1 ${dragHandleProps ? 'pl-0' : 'pl-4'} flex items-center justify-between py-3 pr-4 transition-colors hover:bg-night-800`}
          onClick={() => toggleCategoryExpanded(categoryKey)}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{icon}</span>
            <h3 className="font-semibold text-white">{title}</h3>
            <span className="rounded-full bg-night-700 px-2 py-0.5 text-gray-400 text-sm">
              {objects.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!expanded && objects.length > 0 && (
              <span className="hidden text-gray-500 text-sm sm:block">
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
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </button>
      </div>

      {/* Content - collapsible */}
      {expanded && (
        <div className="border-night-700 border-t">
          <div className="p-4">
            {/* Desktop Grid */}
            <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayObjects.map(obj => (
                <ObjectCard
                  key={obj.objectName}
                  object={obj}
                  nightInfo={nightInfo}
                  weather={weather}
                  onSelect={onObjectClick}
                />
              ))}
            </div>

            {/* Mobile List */}
            <div className="space-y-3 sm:hidden">
              {displayObjects.map(obj => (
                <ObjectCard
                  key={obj.objectName}
                  object={obj}
                  nightInfo={nightInfo}
                  weather={weather}
                  compact
                  onSelect={onObjectClick}
                />
              ))}
            </div>
          </div>

          {/* Show more/less button */}
          {hasMore && (
            <div className="px-4 pb-4">
              <button
                type="button"
                className="w-full rounded-lg py-2 text-sky-400 text-sm transition-colors hover:bg-night-800 hover:text-sky-300"
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
