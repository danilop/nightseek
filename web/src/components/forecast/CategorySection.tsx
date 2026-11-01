import { forwardRef, useState } from 'react';
import { CountBadge } from '@/components/ui/Card';
import FrameFill from '@/components/ui/FrameFill';
import Magnitude from '@/components/ui/Magnitude';
import SectionCard from '@/components/ui/SectionCard';
import { useUIState } from '@/hooks/useUIState';
import { formatSubtype } from '@/lib/utils/format-subtype';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';
import { isMagnitudeEstimate } from '@/lib/utils/magnitude';
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

function getTopObjectsPreview(objects: ScoredObject[], showSubtype: boolean) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {objects.slice(0, 3).map(obj => (
        <span key={obj.objectName} className="inline-flex flex-wrap items-center gap-1">
          <span>
            {obj.visibility.commonName || obj.objectName}
            {showSubtype && obj.subtype ? ` (${formatSubtype(obj.subtype)})` : ''}
          </span>
          <Magnitude
            value={obj.magnitude}
            estimated={isMagnitudeEstimate(obj.category)}
            source={obj.visibility.magnitudeSource}
          />
          <FrameFill visibility={obj.visibility} category={obj.category} />
        </span>
      ))}
    </span>
  );
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
        preview={getTopObjectsPreview(objects, showSubtypeInPreview)}
        expanded={expanded}
        onToggle={() => toggleCategoryExpanded(categoryKey)}
        dragHandleProps={dragHandleProps}
        isDragging={isDragging}
        bodyClassName=""
      >
        <div className="p-4">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{cards(true)}</div>
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
