import { useMemo } from 'react';
import ExplainSection from '@/components/ui/ExplainSection';
import {
  getTwilightWindowLabel,
  TWILIGHT_GUIDE_ORDER,
  TWILIGHT_PHASES,
} from '@/lib/astronomy/twilight';
import {
  clockChangeMinutes,
  formatDurationMinutes,
  formatTimeRange,
  getNightLabel,
} from '@/lib/utils/format';
import type { UnitPreferences } from '@/lib/utils/units';
import { calculateHeadlineNightQuality, calculateNightQuality } from '@/lib/weather/night-quality';
import type { Location, NightForecast } from '@/types';
import NightConditionsTimeline from '../NightConditionsTimeline';

export default function NightQualityCard({
  forecast,
  location,
  timezone = location.timezone,
  units,
}: {
  forecast: NightForecast;
  location: Location;
  timezone?: string;
  units?: UnitPreferences;
}) {
  const { nightInfo, weather } = forecast;
  const headline = useMemo(
    () => calculateHeadlineNightQuality(weather, nightInfo),
    [weather, nightInfo]
  );
  const average = useMemo(() => calculateNightQuality(weather, nightInfo), [weather, nightInfo]);
  const clockShift = clockChangeMinutes(nightInfo.sunset, nightInfo.sunrise, timezone);
  return (
    <section
      className="space-y-3 rounded-xl border border-night-700 bg-night-900 p-4"
      aria-label="Night conditions"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-gray-400 text-xs">{getNightLabel(nightInfo.date, false, timezone)}</p>
          <h3 className="font-semibold text-white">Night conditions</h3>
        </div>
        <p className={`font-semibold ${headline.rating.color}`}>
          <span role="img" aria-label={`Night conditions: ${headline.rating.stars} out of 5`}>
            {headline.rating.starString}
          </span>{' '}
          {headline.rating.label}
        </p>
      </div>
      <p className={weather?.bestTime ? 'text-green-300 text-sm' : 'text-amber-300 text-sm'}>
        {weather?.bestTime
          ? `Recommended · ${formatTimeRange(weather.bestTime.start, weather.bestTime.end, timezone)} · ${formatDurationMinutes((Number(weather.bestTime.end) - Number(weather.bestTime.start)) / 60000)}`
          : weather
            ? weather.observingWindows?.length
              ? 'No remaining observing window'
              : 'No usable observing window in the forecast'
            : 'Weather unavailable · astronomy only'}
      </p>
      {headline.penalties.length > 0 && (
        <p className="text-amber-300 text-xs">
          {headline.penalties
            .slice(0, 2)
            .map(p => p.detail)
            .join(' · ')}
        </p>
      )}
      {nightInfo.astronomicalNightMode === 'none' && (
        <p className="text-amber-300 text-xs">
          No astronomical night ·{' '}
          {nightInfo.observingWindowMode === 'none'
            ? 'Sun too high for night imaging'
            : getTwilightWindowLabel(nightInfo.observingWindowMode)}
        </p>
      )}
      {clockShift !== 0 && (
        <p className="text-amber-300 text-xs">
          Clocks move {clockShift > 0 ? 'forward' : 'back'} {Math.abs(clockShift) / 60}h. Durations
          use elapsed time; repeated times show their UTC offset.
        </p>
      )}
      <NightConditionsTimeline
        key={nightInfo.date.toISOString()}
        location={location}
        units={units}
        nightInfo={nightInfo}
        weather={weather}
        timezone={timezone}
      />
      <ExplainSection title="Why this night rating?">
        <p>{headline.summary}</p>
        <p>{weather?.bestTime?.reason}</p>
        <p>
          Usable periods stay inside the observing night and exclude heavy cloud, rain, strong wind,
          fog and missing forecast hours. Recommendations compare clouds, moonlight, wind, dew,
          transparency and estimated seeing, with a modest preference for longer sessions. Short
          opportunities of at least 30 minutes and pre-dawn periods remain eligible. Times are
          estimates from hourly forecasts; target windows also account for altitude and your
          horizon.
        </p>
        <p>
          Weather: red means blocked, blue means no known blocker, grey means missing data. Moon:
          pale while above the horizon.
        </p>
        <p>
          Darkness duration:{' '}
          <span>
            {(
              (Number(nightInfo.astronomicalDawn) - Number(nightInfo.astronomicalDusk)) /
              3600000
            ).toFixed(1)}
            h
          </span>
        </p>
        <p>
          Night conditions use the recommended interval when available. Target suitability is a
          separate rating for each object and your telescope.
        </p>
        <p>
          Whole-night average:{' '}
          <span className={average.rating.color}>
            {average.rating.starString} {average.rating.label}
          </span>
        </p>
        <dl className="space-y-2">
          {TWILIGHT_GUIDE_ORDER.map(id => (
            <div key={id}>
              <dt className="font-medium">
                {TWILIGHT_PHASES[id].guideLabel} · {TWILIGHT_PHASES[id].guideRange}
              </dt>
              <dd className="text-gray-400 text-xs">{TWILIGHT_PHASES[id].guideDescription}</dd>
            </div>
          ))}
        </dl>
      </ExplainSection>
    </section>
  );
}
