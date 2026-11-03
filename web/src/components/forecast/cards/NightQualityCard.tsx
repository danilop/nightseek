import { useMemo } from 'react';
import ExplainSection from '@/components/ui/ExplainSection';
import NightRating from '@/components/ui/NightRating';
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
import { calculateHeadlineNightQuality } from '@/lib/weather/night-quality';
import type { Location, NightForecast } from '@/types';
import NightConditionsTimeline from '../NightConditionsTimeline';
import NightOpportunitySummary from '../NightOpportunitySummary';

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
  const clockShift = clockChangeMinutes(nightInfo.sunset, nightInfo.sunrise, timezone);
  return (
    <section
      className="space-y-3 rounded-xl border border-night-700 bg-night-900 p-4"
      aria-label="Night opportunity"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-gray-400 text-xs">{getNightLabel(nightInfo.date, false, timezone)}</p>
          <h3 className="font-semibold text-white">Night opportunity</h3>
        </div>
        <p className="font-semibold">
          <NightRating quality={headline} />
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
      <NightOpportunitySummary quality={headline} />
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
          fog and missing forecast hours. Recommended sessions balance conditions and duration; the
          outlined segment marks their strongest conditions. Periods of at least 30 minutes,
          including pre-dawn opportunities, remain eligible. Times are estimates from hourly
          forecasts; target windows also account for altitude and your horizon.
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
          Stars rate remaining dark-sky imaging opportunity. Usable time is weighted by local
          conditions squared. The strongest block earns full time credit and other blocks earn half.
          Four hours at steady quality reach that conditions rating; short or split opportunities
          score lower. Adding usable time cannot lower the score. This is a planning heuristic, not
          a measured success probability. Narrowband and planetary imaging can tolerate more
          moonlight. Target suitability also accounts for your telescope.
        </p>
        <p>
          Confidence reflects missing inputs and forecast lead time; it is not a guarantee. Missing
          weather evidence limits the conditions score. Seeing is estimated, not measured.
        </p>
        <ul className="list-inside list-disc">
          {headline.penalties.map(p => (
            <li key={`${p.key}-${p.detail}`}>{p.detail}</li>
          ))}
        </ul>
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
