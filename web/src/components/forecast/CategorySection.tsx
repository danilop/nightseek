import { forwardRef, useState } from 'react';
import { CountBadge } from '@/components/ui/Card';
import SectionCard from '@/components/ui/SectionCard';
import { useUIState } from '@/hooks/useUIState';
import { formatSubtype } from '@/lib/utils/format-subtype';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import type { NightInfo, NightWeather, ScoredObject } from '@/types';
import ObjectCard from './ObjectCard';
import type { SortMode } from './SortModeControl';

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
  sortMode?: SortMode;
  selectedTime?: Date;
  accessibilityByObject?: ReadonlyMap<ScoredObject, TargetAccessibility>;
  onObjectClick?: (object: ScoredObject, accessibility?: TargetAccessibility) => void;
}

function getTopObjectsPreview(objects: ScoredObject[], showSubtype: boolean): string {
  return objects
    .slice(0, 3)
    .map(obj => {
      const name = obj.visibility.commonName || obj.objectName;
      return showSubtype && obj.subtype ? `${name} (${formatSubtype(obj.subtype)})` : name;
    })
    .join(', ');
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
    sortMode,
    selectedTime,
    accessibilityByObject,
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

  const cards = (compact: boolean) =>
    displayObjects.map(obj => (
      <ObjectCard
        key={obj.objectName}
        object={obj}
        nightInfo={nightInfo}
        weather={weather}
        sortMode={sortMode}
        selectedTime={selectedTime}
        targetAccessibility={accessibilityByObject?.get(obj)}
        compact={compact}
        onSelect={selected => onObjectClick?.(selected, accessibilityByObject?.get(selected))}
      />
    ));

  return (
    <div ref={ref}>
      <SectionCard
        icon={icon}
        title={title}
        badge={<CountBadge count={objects.length} />}
        preview={`Top: ${getTopObjectsPreview(objects, showSubtypeInPreview)}`}
        expanded={expanded}
        onToggle={() => toggleCategoryExpanded(categoryKey)}
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
        bodyClassName=""
      >
        <div className="p-4">
          {/* Desktop Grid */}
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards(false)}
          </div>

          {/* Mobile List */}
          <div className="space-y-3 sm:hidden">{cards(true)}</div>
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
      </SectionCard>
    </div>
  );
});

export default CategorySection;
