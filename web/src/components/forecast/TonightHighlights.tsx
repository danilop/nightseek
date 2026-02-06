import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getOrderedCategories, useUIState } from '@/hooks/useUIState';
import { getNightLabel } from '@/lib/utils/format';
import { getRatingFromScore } from '@/lib/utils/rating';
import { useApp } from '@/stores/AppContext';
import type {
  AstronomicalEvents,
  DSOSubtype,
  NightInfo,
  NightWeather,
  ScoredObject,
} from '@/types';
import CategorySection from './CategorySection';
import DSODetailModal from './DSODetailModal';
import JupiterMoonsCard from './JupiterMoonsCard';

interface TonightHighlightsProps {
  objects: ScoredObject[];
  nightInfo: NightInfo;
  weather: NightWeather | null;
  astronomicalEvents?: AstronomicalEvents;
  latitude?: number;
}

interface CategoryConfig {
  key: string;
  title: string;
  icon: string;
  defaultExpanded: boolean;
  defaultShowCount: number;
  filter: (obj: ScoredObject) => boolean;
  sortOrder: number;
  showSubtypeInPreview?: boolean;
}

// Define category configurations
const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'planets',
    title: 'Planets',
    icon: '🪐',
    defaultExpanded: true,
    defaultShowCount: 8,
    filter: obj => obj.category === 'planet',
    sortOrder: 1,
  },
  {
    key: 'comets',
    title: 'Comets',
    icon: '☄️',
    defaultExpanded: true,
    defaultShowCount: 5,
    filter: obj => obj.category === 'comet',
    sortOrder: 2,
  },
  {
    key: 'minor_planets',
    title: 'Dwarf Planets & Asteroids',
    icon: '🪨',
    defaultExpanded: true,
    defaultShowCount: 5,
    filter: obj => obj.category === 'dwarf_planet' || obj.category === 'asteroid',
    sortOrder: 3,
  },
  {
    key: 'galaxies',
    title: 'Galaxies',
    icon: '🌀',
    defaultExpanded: false,
    defaultShowCount: 6,
    filter: obj =>
      obj.category === 'dso' &&
      (obj.subtype === 'galaxy' ||
        obj.subtype === 'galaxy_pair' ||
        obj.subtype === 'galaxy_triplet' ||
        obj.subtype === 'galaxy_group'),
    sortOrder: 4,
    showSubtypeInPreview: true,
  },
  {
    key: 'nebulae',
    title: 'Nebulae',
    icon: '☁️',
    defaultExpanded: false,
    defaultShowCount: 6,
    filter: obj =>
      obj.category === 'dso' &&
      (obj.subtype === 'emission_nebula' ||
        obj.subtype === 'reflection_nebula' ||
        obj.subtype === 'planetary_nebula' ||
        obj.subtype === 'supernova_remnant' ||
        obj.subtype === 'nebula' ||
        obj.subtype === 'hii_region' ||
        obj.subtype === 'dark_nebula' ||
        obj.subtype === 'cluster_nebula'),
    sortOrder: 5,
    showSubtypeInPreview: true,
  },
  {
    key: 'clusters',
    title: 'Star Clusters',
    icon: '✨',
    defaultExpanded: false,
    defaultShowCount: 6,
    filter: obj =>
      obj.category === 'dso' &&
      (obj.subtype === 'open_cluster' || obj.subtype === 'globular_cluster'),
    sortOrder: 6,
    showSubtypeInPreview: true,
  },
  {
    key: 'milky_way',
    title: 'Milky Way',
    icon: '🌌',
    defaultExpanded: true,
    defaultShowCount: 1,
    filter: obj => obj.category === 'milky_way',
    sortOrder: 7,
  },
  {
    key: 'other',
    title: 'Other Objects',
    icon: '⭐',
    defaultExpanded: false,
    defaultShowCount: 4,
    filter: obj => {
      // Catch anything not in the above categories
      const covered = ['planet', 'comet', 'dwarf_planet', 'asteroid', 'milky_way'];
      if (covered.includes(obj.category)) return false;
      if (obj.category !== 'dso') return true;
      const coveredSubtypes: DSOSubtype[] = [
        'galaxy',
        'galaxy_pair',
        'galaxy_triplet',
        'galaxy_group',
        'emission_nebula',
        'reflection_nebula',
        'planetary_nebula',
        'supernova_remnant',
        'nebula',
        'hii_region',
        'dark_nebula',
        'open_cluster',
        'globular_cluster',
      ];
      return !coveredSubtypes.includes(obj.subtype as DSOSubtype);
    },
    sortOrder: 8,
    showSubtypeInPreview: true,
  },
];

// Sortable wrapper for CategorySection
function SortableCategorySection({
  config,
  categoryObjects,
  nightInfo,
  weather,
  onObjectClick,
}: {
  config: CategoryConfig;
  categoryObjects: ScoredObject[];
  nightInfo: NightInfo;
  weather: NightWeather | null;
  onObjectClick?: (object: ScoredObject) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: config.key,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CategorySection
        categoryKey={config.key}
        title={config.title}
        icon={config.icon}
        objects={categoryObjects}
        nightInfo={nightInfo}
        weather={weather}
        defaultExpanded={config.defaultExpanded}
        defaultShowCount={config.defaultShowCount}
        showSubtypeInPreview={config.showSubtypeInPreview}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        onObjectClick={onObjectClick}
      />
    </div>
  );
}

export default function TonightHighlights({
  objects,
  nightInfo,
  weather,
  astronomicalEvents,
  latitude = 0,
}: TonightHighlightsProps) {
  const { state } = useApp();
  const { settings } = state;
  const { categoryOrder, setCategoryOrder } = useUIState();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedDSO, setSelectedDSO] = useState<ScoredObject | null>(null);

  // Handle DSO card click
  const handleDSOClick = (object: ScoredObject) => {
    setSelectedDSO(object);
  };

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Start drag after moving 8px
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate magnitude range from loaded objects
  const { minMag, maxMag } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const obj of objects) {
      if (obj.magnitude !== null && obj.magnitude !== undefined) {
        min = Math.min(min, obj.magnitude);
        max = Math.max(max, obj.magnitude);
      }
    }
    // Round to reasonable values
    return {
      minMag: Math.floor(min),
      maxMag: Math.ceil(max),
    };
  }, [objects]);

  // Magnitude filter state - load from localStorage or default to max
  const STORAGE_KEY = 'nightseek:magLimit';
  const [magLimit, setMagLimit] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
  });

  // Effective limit: use saved value if within range, otherwise default to max
  const effectiveMagLimit = useMemo(() => {
    if (magLimit !== null && magLimit >= minMag && magLimit <= maxMag) {
      return magLimit;
    }
    return maxMag;
  }, [magLimit, minMag, maxMag]);

  // Persist magnitude limit to localStorage when user changes it
  useEffect(() => {
    if (magLimit !== null) {
      localStorage.setItem(STORAGE_KEY, magLimit.toString());
    }
  }, [magLimit]);

  // Filter objects by magnitude
  const filteredObjects = useMemo(() => {
    return objects.filter(obj => {
      // Objects without magnitude: only show when slider is at max (unfiltered view)
      // This ensures filtering actually reduces counts for astrophotographers
      if (obj.magnitude === null || obj.magnitude === undefined) {
        return effectiveMagLimit >= maxMag;
      }
      return obj.magnitude <= effectiveMagLimit;
    });
  }, [objects, effectiveMagLimit, maxMag]);

  // Group filtered objects by category
  const groupedObjects = useMemo(() => {
    const groups: Record<string, ScoredObject[]> = {};

    for (const config of CATEGORY_CONFIGS) {
      groups[config.key] = filteredObjects
        .filter(config.filter)
        .sort((a, b) => b.totalScore - a.totalScore);
    }

    return groups;
  }, [filteredObjects]);

  // Count total objects
  const totalCount = filteredObjects.length;
  const totalLoaded = objects.length;

  // Get ordered categories (respecting user's custom order)
  const orderedConfigs = useMemo(
    () => getOrderedCategories(CATEGORY_CONFIGS, categoryOrder),
    [categoryOrder]
  );

  // Filter to categories with objects
  const categoriesWithObjects = orderedConfigs.filter(
    config => groupedObjects[config.key].length > 0
  );

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = categoriesWithObjects.findIndex(c => c.key === active.id);
    const newIndex = categoriesWithObjects.findIndex(c => c.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Build new order by moving the active key to its new position
    const activeKey = active.id as string;
    const overKey = over.id as string;
    const newOrder = categoryOrder.filter(k => k !== activeKey);
    const overIdx = newOrder.indexOf(overKey);
    const insertIdx = oldIndex < newIndex ? overIdx + 1 : overIdx;
    newOrder.splice(insertIdx, 0, activeKey);

    setCategoryOrder(newOrder);
  };

  const activeDragConfig = activeDragId
    ? categoriesWithObjects.find(c => c.key === activeDragId)
    : null;

  if (objects.length === 0) {
    return (
      <div className="bg-night-900 rounded-xl border border-night-700 p-6 text-center">
        <Sparkles className="w-8 h-8 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No objects meet the visibility criteria for this night.</p>
        <p className="text-sm text-gray-500 mt-1">Try adjusting the magnitude limit in settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-400" />
          {getNightLabel(nightInfo.date, true)} Targets
        </h3>
        <span className="text-sm text-gray-400">
          {totalCount === totalLoaded
            ? `${totalCount} objects`
            : `${totalCount} of ${totalLoaded} objects`}{' '}
          in {categoriesWithObjects.length} categories
        </span>
      </div>

      {/* Magnitude Filter Slider */}
      {maxMag > minMag && (
        <div className="bg-night-900 rounded-lg border border-night-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="magnitude-limit" className="text-sm text-gray-400">
              Magnitude limit
            </label>
            <span className="text-sm font-medium text-white">≤ {effectiveMagLimit.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-8">{minMag}</span>
            <input
              id="magnitude-limit"
              type="range"
              min={minMag}
              max={maxMag}
              step={0.5}
              value={effectiveMagLimit}
              onChange={e => setMagLimit(parseFloat(e.target.value))}
              className="flex-1 h-2 bg-night-700 rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-sky-500
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:hover:bg-sky-400"
            />
            <span className="text-xs text-gray-500 w-8 text-right">{maxMag}</span>
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-600">
            <span>brighter</span>
            <span>fainter</span>
          </div>
        </div>
      )}

      {/* Tonight's Summary - updates with magnitude filter */}
      <div className="bg-night-900 rounded-xl border border-night-700 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <SummaryItem emoji="🪐" count={groupedObjects.planets?.length ?? 0} label="Planets" />
          <SummaryItem
            emoji="🌌"
            count={
              (groupedObjects.galaxies?.length ?? 0) +
              (groupedObjects.nebulae?.length ?? 0) +
              (groupedObjects.clusters?.length ?? 0) +
              (groupedObjects.other?.length ?? 0)
            }
            label="Deep Sky"
          />
          <SummaryItem
            emoji="⭐"
            count={filteredObjects.filter(o => o.totalScore >= 100).length}
            label="Top Rated"
          />
          <MilkyWayItem milkyWay={groupedObjects.milky_way?.[0] ?? null} />
        </div>
      </div>

      {/* Category Sections with Drag-and-Drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={categoriesWithObjects.map(c => c.key)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-4">
            {categoriesWithObjects.map(config => {
              const section = (
                <SortableCategorySection
                  key={config.key}
                  config={config}
                  categoryObjects={groupedObjects[config.key]}
                  nightInfo={nightInfo}
                  weather={weather}
                  onObjectClick={handleDSOClick}
                />
              );

              // Add Jupiter Moons card after Planets category if Jupiter is visible
              if (config.key === 'planets') {
                const jupiterInPlanets = groupedObjects.planets?.some(
                  p => p.objectName.toLowerCase() === 'jupiter'
                );
                const jupiterMoons = astronomicalEvents?.jupiterMoons;

                if (jupiterInPlanets && jupiterMoons) {
                  return (
                    <div key={config.key} className="space-y-4">
                      {section}
                      <JupiterMoonsCard
                        positions={jupiterMoons.positions}
                        events={jupiterMoons.events}
                        latitude={latitude}
                        nightDate={nightInfo.date}
                      />
                    </div>
                  );
                }
              }

              return section;
            })}
          </div>
        </SortableContext>

        {/* Drag overlay for smooth animation */}
        <DragOverlay>
          {activeDragConfig ? (
            <div className="opacity-80">
              <CategorySection
                categoryKey={activeDragConfig.key}
                title={activeDragConfig.title}
                icon={activeDragConfig.icon}
                objects={groupedObjects[activeDragConfig.key]}
                nightInfo={nightInfo}
                weather={weather}
                defaultExpanded={false}
                defaultShowCount={activeDragConfig.defaultShowCount}
                showSubtypeInPreview={activeDragConfig.showSubtypeInPreview}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Show message if all filtered out */}
      {totalCount === 0 && totalLoaded > 0 && (
        <div className="bg-night-900 rounded-xl border border-night-700 p-6 text-center">
          <p className="text-gray-400">
            No objects with known magnitude ≤ {effectiveMagLimit.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Objects without catalog magnitude data are shown at maximum slider position
          </p>
          <button
            type="button"
            onClick={() => setMagLimit(maxMag)}
            className="text-sm text-sky-400 hover:text-sky-300 mt-2"
          >
            Show all objects
          </button>
        </div>
      )}

      {/* DSO Detail Modal */}
      {selectedDSO && (
        <DSODetailModal
          object={selectedDSO}
          nightInfo={nightInfo}
          telescope={settings.telescope}
          customFOV={settings.customFOV}
          onClose={() => setSelectedDSO(null)}
        />
      )}
    </div>
  );
}

function SummaryItem({ emoji, count, label }: { emoji: string; count: number; label: string }) {
  return (
    <div className={count === 0 ? 'opacity-50' : ''}>
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-lg font-bold text-white">{count}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function MilkyWayItem({ milkyWay }: { milkyWay: ScoredObject | null }) {
  const isVisible = milkyWay !== null;
  // Get rating from score using unified rating system
  const rating = milkyWay ? getRatingFromScore(milkyWay.totalScore, 200) : null;

  return (
    <div className={isVisible ? '' : 'opacity-50'}>
      <div className="text-2xl mb-1">🌌</div>
      {isVisible && rating ? (
        <>
          <div className={`text-lg font-bold ${rating.color}`}>{rating.starString}</div>
          <div className="text-xs text-gray-500">Milky Way ({rating.label})</div>
        </>
      ) : (
        <>
          <div className="text-lg font-bold text-gray-500">—</div>
          <div className="text-xs text-gray-500">Milky Way</div>
        </>
      )}
    </div>
  );
}
