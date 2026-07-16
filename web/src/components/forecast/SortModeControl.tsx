import { Clock } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { formatTime } from '@/lib/utils/format';
import type { NightInfo } from '@/types';

export type SortMode = 'score' | 'altitude';

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

interface TimeSliderProps {
  nightInfo: NightInfo;
  selectedTime: Date;
  onSelectedTimeChange: (time: Date) => void;
  timezone?: string;
}

export function TimeSlider({
  nightInfo,
  selectedTime,
  onSelectedTimeChange,
  timezone,
}: TimeSliderProps) {
  const animationRef = useRef<number | null>(null);
  const sliderPositionRef = useRef(
    getSliderPosition(selectedTime, nightInfo.observingWindowStart, nightInfo.observingWindowEnd)
  );

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const position = Number(e.target.value);
    sliderPositionRef.current = position;
    const time = getTimeFromSlider(
      position,
      nightInfo.observingWindowStart,
      nightInfo.observingWindowEnd
    );
    onSelectedTimeChange(time);
  };

  const handleNowClick = useCallback(() => {
    const nowPosition = getSliderPosition(
      new Date(),
      nightInfo.observingWindowStart,
      nightInfo.observingWindowEnd
    );

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
        nightInfo.observingWindowStart,
        nightInfo.observingWindowEnd
      );
      onSelectedTimeChange(time);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [nightInfo.observingWindowStart, nightInfo.observingWindowEnd, onSelectedTimeChange]);

  const sliderPosition = getSliderPosition(
    selectedTime,
    nightInfo.observingWindowStart,
    nightInfo.observingWindowEnd
  );

  if (nightInfo.observingWindowMode === 'none') {
    return <p className="text-amber-300 text-sm">No usable night or twilight window.</p>;
  }

  return (
    <div>
      {nightInfo.astronomicalNightMode === 'none' && (
        <p className="mb-2 text-amber-300 text-xs">
          Twilight-only window · Sun {nightInfo.minimumSunAltitude.toFixed(1)}° at darkest
        </p>
      )}
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
          {formatTime(selectedTime, timezone)}
        </span>
      </div>
      <div className="mt-1 flex justify-between px-12 text-gray-600 text-xs">
        <span>{nightInfo.astronomicalNightMode === 'none' ? 'Window start' : 'Dusk'}</span>
        <span>{nightInfo.astronomicalNightMode === 'none' ? 'Window end' : 'Dawn'}</span>
      </div>
    </div>
  );
}
