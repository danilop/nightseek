import { ArrowUp, Clock, Star } from 'lucide-react';
import { useCallback, useRef } from 'react';
import type { NightInfo } from '@/types';

export type SortMode = 'score' | 'altitude';

interface SortModeControlProps {
  nightInfo: NightInfo;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  selectedTime: Date;
  onSelectedTimeChange: (time: Date) => void;
  className?: string;
}

function getSliderPosition(time: Date, dusk: Date, dawn: Date): number {
  const start = dusk.getTime();
  const end = dawn.getTime();
  const t = time.getTime();
  if (t <= start) return 0;
  if (t >= end) return 100;
  return ((t - start) / (end - start)) * 100;
}

function getTimeFromSlider(position: number, dusk: Date, dawn: Date): Date {
  const start = dusk.getTime();
  const end = dawn.getTime();
  return new Date(start + (position / 100) * (end - start));
}

function formatSliderTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function SortModeControl({
  nightInfo,
  sortMode,
  onSortModeChange,
  selectedTime,
  onSelectedTimeChange,
  className,
}: SortModeControlProps) {
  const animationRef = useRef<number | null>(null);
  const sliderPositionRef = useRef(
    getSliderPosition(selectedTime, nightInfo.astronomicalDusk, nightInfo.astronomicalDawn)
  );

  const handleModeChange = (mode: SortMode) => {
    if (mode === 'altitude' && sortMode !== 'altitude') {
      // Auto-set to current time when switching to altitude mode
      onSelectedTimeChange(new Date());
    }
    onSortModeChange(mode);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const position = Number(e.target.value);
    sliderPositionRef.current = position;
    const time = getTimeFromSlider(
      position,
      nightInfo.astronomicalDusk,
      nightInfo.astronomicalDawn
    );
    onSelectedTimeChange(time);
  };

  const handleNowClick = useCallback(() => {
    const nowPosition = getSliderPosition(
      new Date(),
      nightInfo.astronomicalDusk,
      nightInfo.astronomicalDawn
    );

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startPosition = sliderPositionRef.current;
    const distance = nowPosition - startPosition;
    const duration = 400;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const newPosition = startPosition + distance * eased;

      sliderPositionRef.current = newPosition;
      const time = getTimeFromSlider(
        newPosition,
        nightInfo.astronomicalDusk,
        nightInfo.astronomicalDawn
      );
      onSelectedTimeChange(time);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [nightInfo.astronomicalDusk, nightInfo.astronomicalDawn, onSelectedTimeChange]);

  const sliderPosition = getSliderPosition(
    selectedTime,
    nightInfo.astronomicalDusk,
    nightInfo.astronomicalDawn
  );

  return (
    <div className={`rounded-lg border border-night-700 bg-night-900 p-3 ${className ?? ''}`}>
      {/* Segmented toggle */}
      <div className="flex gap-1 rounded-lg bg-night-800 p-1">
        <button
          type="button"
          onClick={() => handleModeChange('score')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
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
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
            sortMode === 'altitude'
              ? 'bg-night-700 text-white shadow-sm'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          <ArrowUp className="h-3.5 w-3.5" />
          Up Now
        </button>
      </div>

      {/* Time slider (only in altitude mode) */}
      {sortMode === 'altitude' && (
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNowClick}
              className="flex items-center gap-1 rounded bg-indigo-500/20 px-2 py-1 font-medium text-indigo-400 text-xs transition-colors hover:bg-indigo-500/30"
            >
              <Clock className="h-3 w-3" />
              Now
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={sliderPosition}
              onChange={handleSliderChange}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-night-700 accent-indigo-500 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:hover:bg-indigo-400"
            />
            <span className="w-20 text-right font-medium text-indigo-400 text-sm">
              {formatSliderTime(selectedTime)}
            </span>
          </div>
          <div className="mt-1 flex justify-between px-12 text-gray-600 text-xs">
            <span>Dusk</span>
            <span>Dawn</span>
          </div>
        </div>
      )}
    </div>
  );
}
