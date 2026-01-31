import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DSOSubtype, NightInfo, NightWeather, ScoredObject } from '@/types';
import CategorySection from './CategorySection';

interface TonightHighlightsProps {
  objects: ScoredObject[];
  nightInfo: NightInfo;
  weather: NightWeather | null;
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
        obj.subtype === 'dark_nebula'),
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

export default function TonightHighlights({ objects, nightInfo, weather }: TonightHighlightsProps) {
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
  const categoriesWithObjects = CATEGORY_CONFIGS.filter(
    config => groupedObjects[config.key].length > 0
  );

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
          Tonight's Targets
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

      {/* Category Sections */}
      {CATEGORY_CONFIGS.map(config => {
        const categoryObjects = groupedObjects[config.key];
        if (categoryObjects.length === 0) return null;

        return (
          <CategorySection
            key={config.key}
            title={config.title}
            icon={config.icon}
            objects={categoryObjects}
            nightInfo={nightInfo}
            weather={weather}
            defaultExpanded={config.defaultExpanded}
            defaultShowCount={config.defaultShowCount}
            showSubtypeInPreview={config.showSubtypeInPreview}
          />
        );
      })}

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
  // Convert score (0-200) to percentage for display
  const qualityPercent = milkyWay ? Math.round((milkyWay.totalScore / 200) * 100) : 0;

  // Determine quality label based on score
  const getQualityLabel = (percent: number): string => {
    if (percent >= 70) return 'Excellent';
    if (percent >= 50) return 'Good';
    if (percent >= 30) return 'Fair';
    return 'Poor';
  };

  return (
    <div className={isVisible ? '' : 'opacity-50'}>
      <div className="text-2xl mb-1">🌌</div>
      {isVisible ? (
        <>
          <div className="text-lg font-bold text-white">{qualityPercent}%</div>
          <div className="text-xs text-gray-500">Milky Way ({getQualityLabel(qualityPercent)})</div>
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
