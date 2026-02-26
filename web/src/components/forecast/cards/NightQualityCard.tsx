import { Clock, Info } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { formatTime, formatTimeRange, getNightLabel } from '@/lib/utils/format';
import { calculateNightQuality } from '@/lib/weather/night-quality';
import type { NightForecast, NightInfo } from '@/types';

function formatDarkHours(dusk: Date, dawn: Date): string {
  const hours = (dawn.getTime() - dusk.getTime()) / 3_600_000;
  return `${hours.toFixed(1)}h`;
}

/** Fraction of the sunset→sunrise span at which a time falls (clamped 0–1). */
function nightFraction(time: Date, sunset: Date, sunrise: Date): number {
  const total = sunrise.getTime() - sunset.getTime();
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (time.getTime() - sunset.getTime()) / total));
}

/** Approximate civil (-6°) and nautical (-12°) twilight boundary fractions. */
function twilightBoundaries(nightInfo: NightInfo) {
  const duskPct = nightFraction(nightInfo.astronomicalDusk, nightInfo.sunset, nightInfo.sunrise);
  const dawnPct = nightFraction(nightInfo.astronomicalDawn, nightInfo.sunset, nightInfo.sunrise);

  return {
    civilDuskPct: duskPct / 3,
    nauticalDuskPct: (duskPct * 2) / 3,
    duskPct,
    dawnPct,
    nauticalDawnPct: dawnPct + (1 - dawnPct) / 3,
    civilDawnPct: dawnPct + ((1 - dawnPct) * 2) / 3,
  };
}

interface TwilightPhase {
  name: string;
  description: string;
  colorClass: string;
  sunAltitude: string;
}

const TWILIGHT_ZONES = [
  {
    name: 'Civil Twilight',
    description: 'Horizon visible, brightest stars appearing',
    colorClass: 'text-orange-400',
    altBase: 0,
  },
  {
    name: 'Nautical Twilight',
    description: 'Horizon fading, most stars visible',
    colorClass: 'text-amber-400',
    altBase: 6,
  },
  {
    name: 'Astronomical Twilight',
    description: 'Sky nearly dark, deep-sky becoming viable',
    colorClass: 'text-blue-400',
    altBase: 12,
  },
] as const;

function twilightSegments(boundaries: ReturnType<typeof twilightBoundaries>) {
  const { civilDuskPct, nauticalDuskPct, duskPct, dawnPct, nauticalDawnPct, civilDawnPct } =
    boundaries;
  return [
    { start: 0, end: civilDuskPct, zoneIdx: 0, reverse: false },
    { start: civilDuskPct, end: nauticalDuskPct, zoneIdx: 1, reverse: false },
    { start: nauticalDuskPct, end: duskPct, zoneIdx: 2, reverse: false },
    { start: dawnPct, end: nauticalDawnPct, zoneIdx: 2, reverse: true },
    { start: nauticalDawnPct, end: civilDawnPct, zoneIdx: 1, reverse: true },
    { start: civilDawnPct, end: 1, zoneIdx: 0, reverse: true },
  ];
}

function getTwilightPhase(
  fraction: number,
  boundaries: ReturnType<typeof twilightBoundaries>
): TwilightPhase {
  const { duskPct, dawnPct } = boundaries;

  // Full darkness (astronomical dusk → dawn)
  if (fraction >= duskPct && fraction <= dawnPct) {
    const midFraction = (duskPct + dawnPct) / 2;
    const halfSpan = (dawnPct - duskPct) / 2;
    const distFromMid = Math.abs(fraction - midFraction);
    const alt = Math.round(18 + (1 - distFromMid / (halfSpan || 1)) * 12);
    return {
      name: 'Astronomical Night',
      description: 'Full darkness — ideal for deep-sky imaging',
      colorClass: 'text-indigo-400',
      sunAltitude: `${alt}° below horizon`,
    };
  }

  // Find matching twilight segment
  const segments = twilightSegments(boundaries);
  const seg = segments.find(s => fraction >= s.start && fraction <= s.end) ?? segments[0];
  const zone = TWILIGHT_ZONES[seg.zoneIdx];
  const span = seg.end - seg.start;
  const rawT = span > 0 ? (fraction - seg.start) / span : 0;
  const t = seg.reverse ? 1 - rawT : rawT;
  const alt = Math.round(zone.altBase + t * 6);

  return {
    name: zone.name,
    description: zone.description,
    colorClass: zone.colorClass,
    sunAltitude: `${alt}° below horizon`,
  };
}

/** Convert a Date to slider percentage (0–100), or null if outside range. */
function timeToSlider(time: Date, sunset: Date, sunrise: Date): number | null {
  const startMs = sunset.getTime();
  const endMs = sunrise.getTime();
  const currentMs = time.getTime();
  if (currentMs < startMs || currentMs > endMs) return null;
  return ((currentMs - startMs) / (endMs - startMs)) * 100;
}

/** Convert slider percentage (0–100) to a Date within the night range. */
function sliderToTime(pct: number, sunset: Date, sunrise: Date): Date {
  const startMs = sunset.getTime();
  const endMs = sunrise.getTime();
  return new Date(startMs + (pct / 100) * (endMs - startMs));
}

function NightTimelineScrubber({
  nightInfo,
  isTonight,
}: {
  nightInfo: NightInfo;
  isTonight: boolean;
}) {
  const now = useCurrentTime();
  const animationRef = useRef<number | null>(null);

  const boundaries = useMemo(() => twilightBoundaries(nightInfo), [nightInfo]);

  const nowPosition = useMemo(
    () => timeToSlider(now, nightInfo.sunset, nightInfo.sunrise),
    [now, nightInfo.sunset, nightInfo.sunrise]
  );

  const isNowInRange = isTonight && nowPosition !== null;

  const [pointerPct, setPointerPct] = useState(
    isTonight && nowPosition !== null ? nowPosition : boundaries.duskPct * 100
  );
  const [isTracking, setIsTracking] = useState(isTonight && nowPosition !== null);

  // Auto-track "now" while tracking is enabled
  useEffect(() => {
    if (isTracking && nowPosition !== null) {
      setPointerPct(nowPosition);
    }
  }, [isTracking, nowPosition]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setIsTracking(false);
    setPointerPct(Number(e.target.value));
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const handleNowClick = useCallback(() => {
    const target = timeToSlider(new Date(), nightInfo.sunset, nightInfo.sunrise);
    if (target === null) return;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startPosition = pointerPct;
    const distance = target - startPosition;
    const duration = 400;
    const startTimestamp = performance.now();

    const animate = (currentTimestamp: number) => {
      const elapsed = currentTimestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;

      setPointerPct(startPosition + distance * eased);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
        setIsTracking(true);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [nightInfo.sunset, nightInfo.sunrise, pointerPct]);

  const currentTime = useMemo(
    () => sliderToTime(pointerPct, nightInfo.sunset, nightInfo.sunrise),
    [pointerPct, nightInfo.sunset, nightInfo.sunrise]
  );

  const phase = useMemo(
    () => getTwilightPhase(pointerPct / 100, boundaries),
    [pointerPct, boundaries]
  );

  const { civilDuskPct, nauticalDuskPct, duskPct, dawnPct, nauticalDawnPct, civilDawnPct } =
    boundaries;

  const gradient = `linear-gradient(to right,
    #ea580c 0%,
    #d97706 ${civilDuskPct * 100}%,
    #3b82f6 ${nauticalDuskPct * 100}%,
    #4f46e5 ${duskPct * 100}%,
    #4f46e5 ${dawnPct * 100}%,
    #3b82f6 ${nauticalDawnPct * 100}%,
    #d97706 ${civilDawnPct * 100}%,
    #ea580c 100%)`;

  return (
    <div>
      {/* Gradient bar with pointer and invisible slider */}
      <div className="relative h-5 w-full">
        <div
          className="absolute inset-0 overflow-hidden rounded-full ring-1 ring-white/10"
          style={{ background: gradient }}
        />

        {/* Pointer thumb */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pointerPct}%` }}
        >
          <div className="h-4 w-4 rounded-full border-2 border-white bg-white/90 shadow-black/30 shadow-lg" />
        </div>

        {/* Invisible range input */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.5"
          value={pointerPct}
          onChange={handleSliderChange}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
          aria-label="Night timeline scrubber"
        />
      </div>

      {/* Phase info line */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className={`flex items-center gap-1.5 ${phase.colorClass}`}>
          <span className="inline-block h-2 w-2 rounded-full bg-current" />
          <span className="text-gray-300">{formatTime(currentTime)}</span>
          <span className="text-gray-600">·</span>
          <span className="font-medium">{phase.name}</span>
          <span className="hidden text-gray-500 sm:inline">— Sun {phase.sunAltitude}</span>
        </div>

        {isNowInRange && (
          <button
            type="button"
            onClick={handleNowClick}
            disabled={isTracking}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs transition-colors ${
              isTracking
                ? 'cursor-default bg-night-700 text-gray-500'
                : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
            }`}
            title="Jump to current time"
          >
            <Clock className="h-3 w-3" />
            Now
          </button>
        )}
      </div>

      {/* 4-zone legend */}
      <div className="mt-1.5 flex items-center justify-center gap-3 text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#ea580c' }}
          />{' '}
          Civil
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#d97706' }}
          />{' '}
          Nautical
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#3b82f6' }}
          />{' '}
          Astro
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: '#4f46e5' }}
          />{' '}
          Night
        </span>
      </div>
    </div>
  );
}

interface NightQualityCardProps {
  forecast: NightForecast;
}

export default function NightQualityCard({ forecast }: NightQualityCardProps) {
  const { nightInfo, weather } = forecast;

  const nightQuality = useMemo(
    () => calculateNightQuality(weather, nightInfo),
    [weather, nightInfo]
  );

  const isTonight = useMemo(() => {
    const now = new Date();
    return now >= nightInfo.sunset && now <= nightInfo.sunrise;
  }, [nightInfo.sunset, nightInfo.sunrise]);

  return (
    <div className="rounded-xl border border-night-700 bg-night-900 p-4">
      <div className="space-y-2">
        <h3 className="font-semibold text-white">
          <Tooltip content="Overall rating based on cloud cover, moon phase, transparency, seeing conditions, and dew risk.">
            <span>{getNightLabel(nightInfo.date, true)} Rating</span>
          </Tooltip>
        </h3>
        <div className={`flex items-center gap-2 font-bold text-xl ${nightQuality.rating.color}`}>
          <Tooltip content="5 stars = Excellent, 4 = Very Good, 3 = Good, 2 = Fair, 1 = Poor. Based on weighted scoring of all conditions.">
            <span>{nightQuality.rating.starString}</span>
          </Tooltip>
          <span>{nightQuality.rating.label}</span>
        </div>
        <p className="text-gray-400 text-sm">{nightQuality.summary}</p>

        {/* Night timeline */}
        <div className="rounded-lg bg-night-800 p-3">
          {/* Time labels row */}
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <Tooltip content="Sunset — start of the night period.">
              <span className="text-orange-400">{formatTime(nightInfo.sunset)}</span>
            </Tooltip>
            <Tooltip content="Astronomical dusk — sun 18° below horizon, true darkness begins.">
              <span className="text-indigo-400">{formatTime(nightInfo.astronomicalDusk)}</span>
            </Tooltip>
            <span className="font-medium text-indigo-300">
              {formatDarkHours(nightInfo.astronomicalDusk, nightInfo.astronomicalDawn)}
            </span>
            <Tooltip content="Astronomical dawn — sun rises to 18° below horizon, sky begins brightening.">
              <span className="text-indigo-400">{formatTime(nightInfo.astronomicalDawn)}</span>
            </Tooltip>
            <Tooltip content="Sunrise — end of the night period.">
              <span className="text-orange-400">{formatTime(nightInfo.sunrise)}</span>
            </Tooltip>
          </div>

          {/* Interactive timeline scrubber */}
          <NightTimelineScrubber nightInfo={nightInfo} isTonight={isTonight} />
        </div>

        {forecast.forecastConfidence === 'low' && (
          <div className="flex items-start gap-2 text-amber-400 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Based on celestial conditions only. Weather data is not available beyond 16 days.
            </span>
          </div>
        )}
        {forecast.forecastConfidence === 'medium' && (
          <p className="text-gray-500 text-xs">Air quality data unavailable beyond 5 days</p>
        )}
        {weather?.bestTime ? (
          <p className="text-green-400 text-sm">
            <Tooltip content="Optimal window with lowest cloud cover, best transparency, and minimal dew risk.">
              <span>
                Best:{' '}
                <span className="whitespace-nowrap">
                  {formatTimeRange(weather.bestTime.start, weather.bestTime.end)}
                </span>
              </span>
            </Tooltip>
          </p>
        ) : (
          <p className="text-gray-500 text-sm">
            <Tooltip content="No window with acceptable conditions (low clouds, good transparency, minimal dew risk) found.">
              <span>No good observation window</span>
            </Tooltip>
          </p>
        )}
      </div>
    </div>
  );
}
