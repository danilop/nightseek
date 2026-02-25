import { Camera, Moon, Mountain, Star } from 'lucide-react';
import type { QuickFilterId } from '@/types';

interface QuickFilterBarProps {
  activeFilters: QuickFilterId[];
  onToggle: (id: QuickFilterId) => void;
  onClear: () => void;
  filteredCount: number;
  totalCount: number;
}

const FILTER_PILLS: { id: QuickFilterId; label: string; Icon: typeof Camera }[] = [
  { id: 'hasImaging', label: 'Imaging Window', Icon: Camera },
  { id: 'moonSafe', label: 'Moon-Safe', Icon: Moon },
  { id: 'above45', label: 'Above 45°', Icon: Mountain },
  { id: 'highRated', label: 'Top Rated', Icon: Star },
];

export default function QuickFilterBar({
  activeFilters,
  onToggle,
  onClear,
  filteredCount,
  totalCount,
}: QuickFilterBarProps) {
  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {FILTER_PILLS.map(({ id, label, Icon }) => {
          const isActive = activeFilters.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
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
      </div>
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400">
            {filteredCount} of {totalCount} objects
          </span>
          <button type="button" onClick={onClear} className="text-sky-400 hover:text-sky-300">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
