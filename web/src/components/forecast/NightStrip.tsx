import { Star } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { getMoonPhaseEmoji } from '@/lib/utils/format';
import { calculateNightQuality } from '@/lib/weather/night-quality';
import type { NightForecast } from '@/types';

interface NightStripProps {
  forecasts: NightForecast[];
  selectedIndex: number;
  onSelectNight: (index: number) => void;
  bestNights: string[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function NightStrip({
  forecasts,
  selectedIndex,
  onSelectNight,
  bestNights,
}: NightStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const bestNightSet = new Set(bestNights);

  // Memoize quality calculations to avoid recomputing on every render
  const nightQualities = useMemo(
    () => forecasts.map(f => calculateNightQuality(f.weather, f.nightInfo)),
    [forecasts]
  );

  // Auto-scroll selected chip into view
  useEffect(() => {
    const chip = chipRefs.current.get(selectedIndex);
    if (chip) {
      chip.scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight' && index < forecasts.length - 1) {
      e.preventDefault();
      onSelectNight(index + 1);
      chipRefs.current.get(index + 1)?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      onSelectNight(index - 1);
      chipRefs.current.get(index - 1)?.focus();
    }
  };

  return (
    <div className="relative">
      {/* Scroll fade affordances */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-night-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-gradient-to-l from-night-950 to-transparent" />
      <div
        ref={containerRef}
        className="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1 py-2"
        role="listbox"
        aria-label="Night selection"
      >
        {forecasts.map((forecast, index) => {
          const { nightInfo, forecastConfidence } = forecast;
          const dateKey = nightInfo.date.toISOString().split('T')[0];
          const isBestNight = bestNightSet.has(dateKey);
          const isSelected = index === selectedIndex;
          const nightQuality = nightQualities[index];
          const isLowConfidence = forecastConfidence === 'low';

          const dayName = DAY_NAMES[nightInfo.date.getDay()];
          const dateNum = nightInfo.date.getDate();

          return (
            <button
              key={dateKey}
              ref={el => {
                if (el) chipRefs.current.set(index, el);
                else chipRefs.current.delete(index);
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectNight(index)}
              onKeyDown={e => handleKeyDown(e, index)}
              className={`flex h-[4.5rem] w-[4.5rem] min-w-[4rem] flex-shrink-0 snap-center flex-col items-center justify-center rounded-xl border transition-all ${
                isSelected
                  ? 'border-sky-500/60 bg-sky-600/20 ring-1 ring-sky-500/40'
                  : 'border-night-700 bg-night-900 hover:border-night-600 hover:bg-night-800'
              } ${isBestNight ? 'border-l-2 border-l-green-500' : ''} ${isLowConfidence ? 'opacity-60' : ''}`}
            >
              <span className="text-[0.65rem] text-gray-400 leading-none">{dayName}</span>
              <span className="font-bold text-base text-white leading-tight">{dateNum}</span>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="text-xs leading-none">
                  {getMoonPhaseEmoji(nightInfo.moonPhase)}
                </span>
                <span className={`text-[0.6rem] leading-none ${nightQuality.rating.color}`}>
                  {nightQuality.rating.starString}
                </span>
              </div>
              {isBestNight && <Star className="mt-0.5 h-2.5 w-2.5 text-green-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
