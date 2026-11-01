import { Body } from 'astronomy-engine';
import { useMemo, useState } from 'react';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import {
  getTwilightBoundaries,
  getTwilightGradientCss,
  getTwilightPhaseAtFraction,
} from '@/lib/astronomy/twilight';
import { formatTime, formatTimeRange } from '@/lib/utils/format';
import {
  buildNightTimeline,
  timelinePosition,
  timelineWeatherAt,
} from '@/lib/utils/night-timeline';
import {
  formatSpeed,
  formatTemperature,
  getLocaleUnitDefaults,
  type UnitPreferences,
} from '@/lib/utils/units';
import { observingBlockers } from '@/lib/weather/observing-conditions';
import type { Location, NightInfo, NightWeather } from '@/types';

export default function NightConditionsTimeline({
  nightInfo: night,
  weather,
  timezone,
  location,
  units = getLocaleUnitDefaults(),
}: {
  nightInfo: NightInfo;
  weather: NightWeather | null;
  timezone?: string;
  location: Location;
  units?: UnitPreferences;
}) {
  const now = useCurrentTime();
  const inRange = Number(now) >= Number(night.sunset) && Number(now) <= Number(night.sunrise);
  const [tracking, setTracking] = useState(inRange);
  const [manualPosition, setPosition] = useState(50);
  const position =
    tracking && inRange ? timelinePosition(now, night.sunset, night.sunrise) : manualPosition;
  const segments = useMemo(() => buildNightTimeline(night, weather), [night, weather]);
  const time = new Date(
    Number(night.sunset) + (position / 100) * (Number(night.sunrise) - Number(night.sunset))
  );
  const phase = getTwilightPhaseAtFraction(position / 100, getTwilightBoundaries(night)).phase;
  const calc = useMemo(
    () => new SkyCalculator(location.latitude, location.longitude),
    [location.latitude, location.longitude]
  );
  const sun = calc.getBodyPositionJ2000(Body.Sun, time);
  const sunAltitude = calc.getAltAz(sun.ra, sun.dec, time).altitude;
  const hour = timelineWeatherAt(Number(time), weather);
  const blockers = hour ? observingBlockers(hour) : [];
  const window = weather?.bestTime;
  const start = window ? timelinePosition(window.start, night.sunset, night.sunrise) : 0;
  const width = window ? timelinePosition(window.end, night.sunset, night.sunrise) - start : 0;
  return (
    <div
      className="space-y-2 rounded-xl bg-night-800/60 p-3"
      role="group"
      aria-label="Night conditions timeline"
    >
      <div className="ml-16 flex justify-between text-gray-300 text-xs tabular-nums">
        <time>{formatTime(night.sunset, timezone)}</time>
        <time>{formatTime(night.sunrise, timezone)}</time>
      </div>
      <div className="relative grid grid-cols-[4rem_1fr] items-center gap-y-2 text-gray-300 text-xs">
        <div className="pointer-events-none absolute inset-y-0 right-0 left-16" aria-hidden="true">
          <span
            className="absolute z-10 h-full border-white/80 border-l"
            style={{ left: `${position}%` }}
          />
        </div>
        <span>Darkness</span>
        <div
          className="h-4 rounded"
          role="img"
          aria-label={`Darkness: ${night.astronomicalNightMode === 'none' ? 'no astronomical night' : formatTimeRange(night.astronomicalDusk, night.astronomicalDawn, timezone)}`}
          style={{ background: getTwilightGradientCss(getTwilightBoundaries(night)) }}
        />
        <span>Weather</span>
        <div
          className="relative h-4 overflow-hidden rounded bg-night-700"
          role="img"
          aria-label="Weather track: red means a weather blocker; blue means no known blocker; grey means unavailable. Inspect a time for conditions."
        >
          {segments.map(s => (
            <span
              key={s.time}
              className={`absolute inset-y-0 ${s.weather === 'blocked' ? 'bg-red-400/80' : s.weather === 'available' ? 'bg-sky-400/70' : 'bg-night-700'}`}
              style={{ left: `${s.left}%`, width: `${s.width}%` }}
            />
          ))}
        </div>
        <span>Moon up</span>
        <div
          className="relative h-4 overflow-hidden rounded bg-night-700"
          role="img"
          aria-label="Moon track: pale means above the horizon; dark means below; grey means unavailable."
        >
          {segments.map(s => (
            <span
              key={s.time}
              className={`absolute inset-y-0 ${s.moon === 'up' ? 'bg-slate-200/80' : s.moon === 'down' ? 'bg-night-950' : 'bg-night-700'}`}
              style={{ left: `${s.left}%`, width: `${s.width}%` }}
            />
          ))}
        </div>
        <span>Best window</span>
        <div
          className="relative h-4 overflow-hidden rounded bg-night-700"
          role="img"
          aria-label={
            window
              ? `Best conditions: ${formatTimeRange(window.start, window.end, timezone)}`
              : 'No practical multi-hour window'
          }
        >
          {window && (
            <span
              className="absolute inset-y-0 rounded bg-green-400"
              style={{ left: `${start}%`, width: `${width}%` }}
            />
          )}
        </div>
      </div>
      <label className="grid grid-cols-[4rem_1fr] items-center text-gray-400 text-xs">
        Inspect time
        <input
          type="range"
          min="0"
          max="100"
          step="0.5"
          value={position}
          onChange={e => {
            setTracking(false);
            setPosition(Number(e.target.value));
          }}
          aria-label="Night timeline scrubber"
          aria-valuetext={`${formatTime(time, timezone)} · ${phase.label}`}
          className="h-11 w-full accent-sky-400 focus-visible:outline-sky-300"
        />
      </label>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          <span className={phase.textClass}>{phase.label}</span>
          <span className="text-gray-400">
            Sun {Math.round(Math.abs(sunAltitude))}° {sunAltitude < 0 ? 'below' : 'above'} horizon
          </span>
        </span>
        {inRange && (
          <button
            type="button"
            disabled={tracking}
            onClick={() => setTracking(true)}
            className="min-h-11 px-2 text-sky-300 disabled:text-gray-500"
          >
            Now
          </button>
        )}
      </div>
      <p aria-live="polite" className="text-gray-300 text-xs">
        <span className="font-medium text-white">{formatTime(time, timezone)}</span> ·{' '}
        {hour
          ? `${Math.round(hour.cloudCover)}% cloud · ${hour.windGust == null ? 'wind' : 'gusts'} ${formatSpeed(hour.windGust ?? hour.windSpeed, units.speed)} · ${formatTemperature(hour.temperature, units.temperature)}${blockers.length ? ` · ${blockers.join(', ')}` : ' · no known weather blocker'}`
          : 'Weather unavailable for this time'}
      </p>
      <p className="text-gray-400 text-xs">
        Red: weather blocker · blue: no known blocker · grey: no data. Moon: pale when up.
      </p>
    </div>
  );
}
