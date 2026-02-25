import { useEffect, useRef, useState } from 'react';
import { getSortFieldConfigs, getSortLabel } from '@/lib/utils/secondary-sort';
import type { SecondarySortField } from '@/types';

interface SecondarySortDropdownProps {
  value: SecondarySortField;
  onChange: (field: SecondarySortField) => void;
}

export default function SecondarySortDropdown({ value, onChange }: SecondarySortDropdownProps) {
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="rounded-lg border border-night-700 bg-night-800 px-3 py-1.5 text-gray-300 text-xs transition-colors hover:text-white"
      >
        Sort: {getSortLabel(value)} ▼
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
