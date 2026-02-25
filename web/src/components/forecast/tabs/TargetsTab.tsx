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
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { getOrderedCategories, useUIState } from '@/hooks/useUIState';
import { getEffectiveFOV } from '@/lib/telescopes/presets';
import { getAltitudeAtTime } from '@/lib/utils/altitude-interpolation';
import { getNightLabel } from '@/lib/utils/format';
import { applyQuickFilters } from '@/lib/utils/quick-filters';
import { getRatingFromScore } from '@/lib/utils/rating';
import { getSecondarySortComparator } from '@/lib/utils/secondary-sort';
import { selectTonightPicks } from '@/lib/utils/tonight-picks';
import { useApp } from '@/stores/AppContext';
import type {
  AstronomicalEvents,
  DSOSubtype,
  NightInfo,
  NightWeather,
  ScoredObject,
} from '@/types';
import CategorySection from '../CategorySection';
import JupiterMoonsCard from '../JupiterMoonsCard';
import type { SortMode } from '../SortModeControl';
import TargetsToolbar from '../TargetsToolbar';
import TonightPicksCard from '../TonightPicksCard';

interface TargetsTabProps {
  objects: ScoredObject[];
  nightInfo: NightInfo;
  weather: NightWeather | null;
  astronomicalEvents?: AstronomicalEvents;
  latitude?: number;
  onObjectSelect: (object: ScoredObject) => void;
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
  isSpecial?: boolean; // Special categories like Jupiter Moons that don't use CategorySection
}

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
    key: 'jupiter_moons',
    title: "Jupiter's Galilean Moons",
    icon: '♃',
    defaultExpanded: true,
    defaultShowCount: 0,
    filter: () => false, // No regular objects — uses JupiterMoonsCard
    sortOrder: 1.5,
    isSpecial: true,
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
    title: 'Minor Planets',
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

function SortableCategorySection({
  config,
  categoryObjects,
  nightInfo,
  weather,
  sortMode,
  selectedTime,
  onObjectClick,
}: {
  config: CategoryConfig;
  categoryObjects: ScoredObject[];
  nightInfo: NightInfo;
  weather: NightWeather | null;
  sortMode?: SortMode;
  selectedTime?: Date;
  onObjectClick: (object: ScoredObject) => void;
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
        sortMode={sortMode}
        selectedTime={selectedTime}
        onObjectClick={onObjectClick}
      />
    </div>
  );
}

function SortableJupiterMoons({
  id,
  jupiterMoons,
  latitude,
  nightDate,
}: {
  id: string;
  jupiterMoons: NonNullable<AstronomicalEvents['jupiterMoons']>;
  latitude: number;
  nightDate: Date;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${isDragging ? 'z-10' : ''}`}>
      <JupiterMoonsCard
        positions={jupiterMoons.positions}
        events={jupiterMoons.events}
        latitude={latitude}
        nightDate={nightDate}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export default function TargetsTab({
  objects,
  nightInfo,
  weather,
  astronomicalEvents,
  latitude = 0,
  onObjectSelect,
}: TargetsTabProps) {
  const {
    categoryOrder,
    setCategoryOrder,
    secondarySort,
    setSecondarySort,
    activeQuickFilters,
    toggleQuickFilter,
    clearQuickFilters,
    tonightPicksDismissed,
    setTonightPicksDismissed,
  } = useUIState();
  const { state } = useApp();
  const fov = getEffectiveFOV(state.settings.telescope, state.settings.customFOV);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [selectedTime, setSelectedTime] = useState<Date>(() => new Date());

  // Check if we're currently in the dark window
  const now = useCurrentTime();
  const isDarkWindow =
    now.getTime() >= nightInfo.astronomicalDusk.getTime() &&
    now.getTime() <= nightInfo.astronomicalDawn.getTime();

  // Auto-revert to score mode when dark window ends
  useEffect(() => {
    if (!isDarkWindow && sortMode === 'altitude') {
      setSortMode('score');
    }
  }, [isDarkWindow, sortMode]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate magnitude range
  const { minMag, maxMag } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const obj of objects) {
      if (obj.magnitude !== null && obj.magnitude !== undefined) {
        min = Math.min(min, obj.magnitude);
        max = Math.max(max, obj.magnitude);
      }
    }
    return {
      minMag: Math.floor(min),
      maxMag: Math.ceil(max),
    };
  }, [objects]);

  // Magnitude filter state
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

  const effectiveMagLimit = useMemo(() => {
    if (magLimit !== null && magLimit >= minMag && magLimit <= maxMag) {
      return magLimit;
    }
    return maxMag;
  }, [magLimit, minMag, maxMag]);

  useEffect(() => {
    if (magLimit !== null) {
      localStorage.setItem(STORAGE_KEY, magLimit.toString());
    }
  }, [magLimit]);

  // Filter objects by magnitude
  const magFilteredObjects = useMemo(() => {
    return objects.filter(obj => {
      if (obj.magnitude === null || obj.magnitude === undefined) {
        return effectiveMagLimit >= maxMag;
      }
      return obj.magnitude <= effectiveMagLimit;
    });
  }, [objects, effectiveMagLimit, maxMag]);

  // Tonight picks (computed from mag-filtered, ignoring quick filters)
  const tonightPicks = useMemo(() => selectTonightPicks(magFilteredObjects), [magFilteredObjects]);

  // Apply quick filters
  const filteredObjects = useMemo(
    () => applyQuickFilters(magFilteredObjects, activeQuickFilters),
    [magFilteredObjects, activeQuickFilters]
  );

  // Secondary sort comparator
  const secondarySortComparator = useMemo(
    () => getSecondarySortComparator(secondarySort, fov),
    [secondarySort, fov]
  );

  // Group filtered objects by category
  const groupedObjects = useMemo(() => {
    const groups: Record<string, ScoredObject[]> = {};
    for (const config of CATEGORY_CONFIGS) {
      groups[config.key] = filteredObjects.filter(config.filter).sort((a, b) => {
        if (sortMode === 'altitude') {
          const altA = getAltitudeAtTime(a.visibility.altitudeSamples, selectedTime);
          const altB = getAltitudeAtTime(b.visibility.altitudeSamples, selectedTime);
          if (altA <= 0 && altB > 0) return 1;
          if (altB <= 0 && altA > 0) return -1;
          return altB - altA;
        }
        return secondarySortComparator(a, b);
      });
    }
    return groups;
  }, [filteredObjects, sortMode, selectedTime, secondarySortComparator]);

  const totalCount = filteredObjects.length;
  const totalLoaded = objects.length;

  const orderedConfigs = useMemo(
    () => getOrderedCategories(CATEGORY_CONFIGS, categoryOrder),
    [categoryOrder]
  );

  // Check if Jupiter's Moons section should be visible
  const showJupiterMoons =
    groupedObjects.planets?.some(p => p.objectName.toLowerCase() === 'jupiter') &&
    !!astronomicalEvents?.jupiterMoons;

  const categoriesWithObjects = orderedConfigs.filter(config => {
    if (config.key === 'jupiter_moons') return showJupiterMoons;
    return groupedObjects[config.key].length > 0;
  });

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
      <div className="rounded-xl border border-night-700 bg-night-900 p-6 text-center">
        <Sparkles className="mx-auto mb-3 h-8 w-8 text-gray-600" />
        <p className="text-gray-400">No objects meet the visibility criteria for this night.</p>
        <p className="mt-1 text-gray-500 text-sm">Try adjusting the magnitude limit in settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Sparkles className="h-5 w-5 text-yellow-400" />
          {getNightLabel(nightInfo.date, true)} Targets
        </h3>
        <span className="text-gray-400 text-sm">
          {totalCount === totalLoaded
            ? `${totalCount} objects`
            : `${totalCount} of ${totalLoaded} objects`}{' '}
          in {categoriesWithObjects.length} categories
        </span>
      </div>

      {/* Magnitude Filter Slider */}
      {maxMag > minMag && (
        <div className="rounded-lg border border-night-700 bg-night-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="magnitude-limit" className="text-gray-400 text-sm">
              Magnitude limit
            </label>
            <span className="font-medium text-sm text-white">≤ {effectiveMagLimit.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-8 text-gray-500 text-xs">{minMag}</span>
            <input
              id="magnitude-limit"
              type="range"
              min={minMag}
              max={maxMag}
              step={0.5}
              value={effectiveMagLimit}
              onChange={e => setMagLimit(parseFloat(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-night-700 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:hover:bg-sky-400"
            />
            <span className="w-8 text-right text-gray-500 text-xs">{maxMag}</span>
          </div>
          <div className="mt-1 flex justify-between text-gray-600 text-xs">
            <span>brighter</span>
            <span>fainter</span>
          </div>
        </div>
      )}

      {/* Tonight's Best Picks (only affected by magnitude slider) */}
      {tonightPicks.length > 0 && !tonightPicksDismissed && (
        <TonightPicksCard
          picks={tonightPicks}
          onObjectSelect={onObjectSelect}
          onDismiss={() => setTonightPicksDismissed(true)}
        />
      )}

      {/* Unified Filter + Sort Toolbar */}
      <TargetsToolbar
        activeFilters={activeQuickFilters}
        onToggleFilter={toggleQuickFilter}
        onClearFilters={clearQuickFilters}
        filteredCount={totalCount}
        totalCount={magFilteredObjects.length}
        isDarkWindow={isDarkWindow}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        nightInfo={nightInfo}
        selectedTime={selectedTime}
        onSelectedTimeChange={setSelectedTime}
        secondarySort={secondarySort}
        onSecondarySortChange={setSecondarySort}
      />

      {/* Summary grid */}
      <div className="rounded-xl border border-night-700 bg-night-900 p-4">
        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
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
              // Jupiter Moons: render as a sortable wrapper around JupiterMoonsCard
              if (config.key === 'jupiter_moons' && astronomicalEvents?.jupiterMoons) {
                return (
                  <SortableJupiterMoons
                    key={config.key}
                    id={config.key}
                    jupiterMoons={astronomicalEvents.jupiterMoons}
                    latitude={latitude}
                    nightDate={nightInfo.date}
                  />
                );
              }

              return (
                <SortableCategorySection
                  key={config.key}
                  config={config}
                  categoryObjects={groupedObjects[config.key]}
                  nightInfo={nightInfo}
                  weather={weather}
                  sortMode={sortMode}
                  selectedTime={selectedTime}
                  onObjectClick={onObjectSelect}
                />
              );
            })}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeDragConfig ? (
            <div className="opacity-80">
              {activeDragConfig.key === 'jupiter_moons' && astronomicalEvents?.jupiterMoons ? (
                <JupiterMoonsCard
                  positions={astronomicalEvents.jupiterMoons.positions}
                  events={astronomicalEvents.jupiterMoons.events}
                  latitude={latitude}
                  nightDate={nightInfo.date}
                />
              ) : (
                <CategorySection
                  categoryKey={activeDragConfig.key}
                  title={activeDragConfig.title}
                  icon={activeDragConfig.icon}
                  objects={groupedObjects[activeDragConfig.key] ?? []}
                  nightInfo={nightInfo}
                  weather={weather}
                  defaultExpanded={false}
                  defaultShowCount={activeDragConfig.defaultShowCount}
                  showSubtypeInPreview={activeDragConfig.showSubtypeInPreview}
                  sortMode={sortMode}
                  selectedTime={selectedTime}
                />
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Show message if all filtered out */}
      {totalCount === 0 && totalLoaded > 0 && (
        <div className="rounded-xl border border-night-700 bg-night-900 p-6 text-center">
          <p className="text-gray-400">No objects match the current filters</p>
          <p className="mt-1 text-gray-500 text-xs">
            Try adjusting the magnitude limit or removing quick filters
          </p>
          <button
            type="button"
            onClick={() => {
              setMagLimit(maxMag);
              clearQuickFilters();
            }}
            className="mt-2 text-sky-400 text-sm hover:text-sky-300"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ emoji, count, label }: { emoji: string; count: number; label: string }) {
  return (
    <div className={count === 0 ? 'opacity-50' : ''}>
      <div className="mb-1 text-2xl">{emoji}</div>
      <div className="font-bold text-lg text-white">{count}</div>
      <div className="text-gray-500 text-xs">{label}</div>
    </div>
  );
}

function MilkyWayItem({ milkyWay }: { milkyWay: ScoredObject | null }) {
  const isVisible = milkyWay !== null;
  const rating = milkyWay ? getRatingFromScore(milkyWay.totalScore, 200) : null;

  return (
    <div className={isVisible ? '' : 'opacity-50'}>
      <div className="mb-1 text-2xl">🌌</div>
      {isVisible && rating ? (
        <>
          <div className={`font-bold text-lg ${rating.color}`}>{rating.starString}</div>
          <div className="text-gray-500 text-xs">Milky Way ({rating.label})</div>
        </>
      ) : (
        <>
          <div className="font-bold text-gray-500 text-lg">—</div>
          <div className="text-gray-500 text-xs">Milky Way</div>
        </>
      )}
    </div>
  );
}
