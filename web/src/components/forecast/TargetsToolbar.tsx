import { ArrowUp, Camera, ChevronDown, Moon, Mountain, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getSortFieldConfigs, getSortLabel } from '@/lib/utils/secondary-sort';
import type { NightInfo, QuickFilterId, SecondarySortField } from '@/types';
import type { SortMode } from './SortModeControl';
import { TimeSlider } from './SortModeControl';

const FILTER_PILLS: { id: QuickFilterId; label: string; Icon: typeof Camera }[] = [
  { id: 'hasImaging', label: 'Imaging Window', Icon: Camera },
  { id: 'moonSafe', label: 'Moon-Safe', Icon: Moon },
  { id: 'above45', label: 'Above 45°', Icon: Mountain },
  { id: 'highRated', label: 'Top Rated', Icon: Star },
];

interface TargetsToolbarProps {
  activeFilters: QuickFilterId[];
  onToggleFilter: (id: QuickFilterId) => void;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
  isDarkWindow: boolean;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  nightInfo: NightInfo;
  selectedTime: Date;
  onSelectedTimeChange: (time: Date) => void;
  secondarySort: SecondarySortField;
  onSecondarySortChange: (field: SecondarySortField) => void;
}

export default function TargetsToolbar({
  activeFilters,
  onToggleFilter,
  onClearFilters,
  filteredCount,
  totalCount,
  isDarkWindow,
  sortMode,
  onSortModeChange,
  nightInfo,
  selectedTime,
  onSelectedTimeChange,
  secondarySort,
  onSecondarySortChange,
}: TargetsToolbarProps) {
  const hasActiveFilters = activeFilters.length > 0;

  const handleModeChange = (mode: SortMode) => {
    if (mode === 'altitude' && sortMode !== 'altitude') {
      onSelectedTimeChange(new Date());
    }
    onSortModeChange(mode);
  };

  return (
    <div className="rounded-xl border border-night-700 bg-night-900">
      {/* FILTER row */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <span className="shrink-0 font-semibold text-[10px] text-gray-500 uppercase tracking-wider">
          Filter
        </span>
        {FILTER_PILLS.map(({ id, label, Icon }) => {
          const isActive = activeFilters.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggleFilter(id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                isActive
                  ? 'border-sky-500/30 bg-sky-500/20 text-sky-400'
                  : 'border-transparent bg-night-800 text-gray-400 hover:border-night-600'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
        {hasActiveFilters && (
          <span className="ml-auto shrink-0 text-gray-400 text-xs">
            {filteredCount}/{totalCount}{' '}
            <button
              type="button"
              onClick={onClearFilters}
              className="text-sky-400 hover:text-sky-300"
            >
              Clear
            </button>
          </span>
        )}
      </div>

      <div className="border-night-700/50 border-t" />

      {/* SORT row */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <span className="shrink-0 font-semibold text-[10px] text-gray-500 uppercase tracking-wider">
          Sort
        </span>
        {isDarkWindow && (
          <div className="flex gap-0.5 rounded-lg bg-night-800 p-0.5">
            <button
              type="button"
              onClick={() => handleModeChange('score')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
                sortMode === 'score'
                  ? 'bg-night-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Star className="h-3.5 w-3.5" />
              Best Tonight
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('altitude')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
                sortMode === 'altitude'
                  ? 'bg-night-700 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              Up Now
            </button>
          </div>
        )}
        {sortMode === 'score' && (
          <SecondarySortInline value={secondarySort} onChange={onSecondarySortChange} />
        )}
      </div>

      {/* Time slider (altitude mode only) */}
      {sortMode === 'altitude' && (
        <div className="border-night-700/50 border-t px-4 py-2.5">
          <TimeSlider
            nightInfo={nightInfo}
            selectedTime={selectedTime}
            onSelectedTimeChange={onSelectedTimeChange}
          />
        </div>
      )}
    </div>
  );
}

function SecondarySortInline({
  value,
  onChange,
}: {
  value: SecondarySortField;
  onChange: (field: SecondarySortField) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const configs = getSortFieldConfigs();

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 rounded-md bg-night-800 px-2.5 py-1 text-xs"
      >
        <span className="text-gray-500">by</span>
        <span className="font-medium text-gray-300">{getSortLabel(value)}</span>
        <ChevronDown className="h-3 w-3 text-gray-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 min-w-[160px] rounded-lg border border-night-700 bg-night-800 py-1 shadow-lg">
          {configs.map(({ field, label }) => (
            <button
              key={field}
              type="button"
              onClick={() => {
                onChange(field);
                setOpen(false);
              }}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
                field === value ? 'bg-night-700 text-white' : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
