import {
  ChevronDown,
  ChevronUp,
  CloudOff,
  CloudSun,
  Droplets,
  Eye,
  Telescope,
  Wind,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import {
  getMoonPhaseEmoji as getExactMoonPhaseEmoji,
  getMoonPhaseName as getExactMoonPhaseName,
} from '@/lib/astronomy/moon-phases';
import {
  formatTime,
  formatTimeRange,
  getMoonPhaseEmoji,
  getMoonPhaseName,
  getWeatherDescription,
  getWeatherEmoji,
} from '@/lib/utils/format';
import { getSeeingForecastColorClass } from '@/lib/utils/quality-helpers';
import {
  formatPressure,
  formatSpeed,
  formatTemperature,
  getPressureUnitLabel,
} from '@/lib/utils/units';
import { useApp } from '@/stores/AppContext';
import type { NightForecast, NightInfo } from '@/types';
import HourlyConditionsTimeline from '../HourlyConditionsTimeline';

interface WeatherSummaryCardProps {
  forecast: NightForecast;
  timezone?: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI component with multiple conditional weather sections
export default function WeatherSummaryCard({ forecast, timezone }: WeatherSummaryCardProps) {
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);
  const { nightInfo, weather } = forecast;
  const { state } = useApp();
  const { units } = state.settings;

  if (!weather) {
    return (
      <div className="rounded-xl border border-night-700 bg-night-900 p-4">
        <div className="mb-2 flex items-center gap-2">
          <CloudOff className="h-4 w-4 text-gray-500" />
          <h3 className="font-semibold text-gray-400">Weather Forecast Unavailable</h3>
        </div>
        <p className="text-gray-500 text-sm">
          Weather data is not available for this date. Scores are based on astronomical data (moon
          phase, object positions, seasonal visibility).
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-night-700 bg-night-900">
      <button
        type="button"
        className="flex w-full items-center justify-between border-night-700 border-b px-4 py-3"
        onClick={() => setShowWeatherDetails(!showWeatherDetails)}
      >
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <CloudSun className="h-4 w-4 text-sky-400" />
          Weather Conditions
        </h3>
        {showWeatherDetails ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      <div className="p-4">
        {/* Summary grid */}
        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          <div className="cursor-help">
            <Tooltip content="Average cloud cover during the night. Lower is better for observing. 0-25% is ideal.">
              <span className="block">
                <div className="mb-1 text-3xl">{getWeatherEmoji(weather.avgCloudCover)}</div>
                <div className="text-gray-400 text-sm">
                  {getWeatherDescription(weather.avgCloudCover)}
                </div>
                <div className="text-gray-500 text-xs">
                  {Math.round(weather.avgCloudCover)}% clouds
                </div>
              </span>
            </Tooltip>
          </div>

          <div className="cursor-help">
            <Tooltip content="Moon phase affects sky brightness. New moon is best for deep-sky objects. Full moon is good for lunar and planetary observation.">
              <span className="block">
                <div className="mb-1 text-3xl">
                  {nightInfo.moonPhaseExact
                    ? getExactMoonPhaseEmoji(nightInfo.moonPhaseExact.phase)
                    : getMoonPhaseEmoji(nightInfo.moonPhase)}
                </div>
                <div className="text-gray-400 text-sm">
                  {nightInfo.moonPhaseExact
                    ? getExactMoonPhaseName(nightInfo.moonPhaseExact.phase)
                    : getMoonPhaseName(nightInfo.moonPhase)}
                </div>
                <div className="text-gray-500 text-xs">
                  {nightInfo.moonPhaseExact?.isTonight
                    ? `at ${formatTime(nightInfo.moonPhaseExact.time, timezone)}`
                    : `${Math.round(nightInfo.moonIllumination)}% illuminated`}
                </div>
              </span>
            </Tooltip>
          </div>

          {weather.avgWindSpeedKmh !== null && (
            <div className="cursor-help">
              <Tooltip content="Average wind speed. High winds cause telescope shake and poor seeing. Calm conditions are ideal.">
                <span className="block">
                  <div className="mb-1 flex items-center justify-center text-2xl text-sky-400">
                    <Wind className="h-8 w-8" />
                  </div>
                  <div className="text-gray-400 text-sm">
                    {formatSpeed(weather.avgWindSpeedKmh, units.speed)}
                  </div>
                  <div className="text-gray-500 text-xs">Avg wind</div>
                </span>
              </Tooltip>
            </div>
          )}

          {weather.avgHumidity !== null && (
            <div className="cursor-help">
              <Tooltip content="Average humidity. High humidity increases dew risk and can affect transparency.">
                <span className="block">
                  <div className="mb-1 flex items-center justify-center text-2xl text-blue-400">
                    <Droplets className="h-8 w-8" />
                  </div>
                  <div className="text-gray-400 text-sm">{Math.round(weather.avgHumidity)}%</div>
                  <div className="text-gray-500 text-xs">Humidity</div>
                </span>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Seeing Forecast */}
        {nightInfo.seeingForecast && (
          <SeeingForecastCard seeingForecast={nightInfo.seeingForecast} />
        )}

        {/* Hourly Conditions Timeline */}
        <HourlyConditionsTimeline
          weather={weather}
          temperatureUnit={units.temperature}
          timezone={timezone}
        />

        {/* Expanded Details */}
        {showWeatherDetails && (
          <div className="mt-4 grid gap-4 border-night-700 border-t pt-4 sm:grid-cols-2">
            {weather.transparencyScore !== null && (
              <DetailRow
                icon={<Eye className="h-4 w-4" />}
                label="Transparency"
                value={`${Math.round(weather.transparencyScore)}%`}
                subtext={
                  weather.avgAerosolOpticalDepth !== null
                    ? `AOD: ${weather.avgAerosolOpticalDepth.toFixed(3)}`
                    : undefined
                }
                tooltip="How clear the atmosphere is. Higher = less haze, dust, and aerosols. AOD (Aerosol Optical Depth) measures particles in the air; lower is better."
              />
            )}

            {weather.maxPrecipProbability !== null && (
              <DetailRow
                icon={<Droplets className="h-4 w-4" />}
                label="Precipitation"
                value={`${weather.maxPrecipProbability}%`}
                subtext="Max probability"
                tooltip="Maximum chance of rain or snow during the night. Any precipitation will prevent observing."
              />
            )}

            {weather.avgTemperatureC !== null && (
              <DetailRow
                icon={<span className="text-sm">🌡️</span>}
                label="Temperature"
                value={formatTemperature(weather.avgTemperatureC, units.temperature)}
                tooltip="Average air temperature during the night. Colder temperatures increase dew risk but can improve seeing."
              />
            )}

            {weather.pressureTrend && (
              <DetailRow
                icon={<span className="text-sm">📊</span>}
                label="Pressure"
                value={formatPressure(weather.avgPressureHpa, units.pressure)}
                subtext={`Trend: ${weather.pressureTrend}`}
                tooltip={`Atmospheric pressure in ${getPressureUnitLabel(units.pressure)}. Stable or rising pressure usually means clearer skies. Falling pressure often indicates incoming weather.`}
              />
            )}

            {nightInfo.localSiderealTimeAtMidnight && (
              <DetailRow
                icon={<span className="text-sm">🌟</span>}
                label="LST at Midnight"
                value={nightInfo.localSiderealTimeAtMidnight}
                subtext="Local Sidereal Time"
                tooltip="Local Sidereal Time at midnight. Objects with this Right Ascension will be at their highest point (transit) at midnight."
              />
            )}

            {weather.clearWindows.length > 0 && (
              <div className="sm:col-span-2">
                <div className="mb-2 text-gray-400 text-sm">Clear Windows</div>
                <div className="flex flex-wrap gap-2">
                  {weather.clearWindows.map(window => (
                    <span
                      key={`${window.start.getTime()}-${window.end.getTime()}`}
                      className="rounded bg-green-500/20 px-2 py-1 text-green-400 text-xs"
                    >
                      {formatTimeRange(window.start, window.end, timezone)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  subtext,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  tooltip?: string;
}) {
  const labelContent = tooltip ? (
    <Tooltip content={tooltip}>
      <span className="border-gray-500 border-b border-dotted">{label}</span>
    </Tooltip>
  ) : (
    label
  );

  return (
    <div className="flex items-start gap-3">
      <div className="text-gray-400">{icon}</div>
      <div>
        <div className="text-gray-400 text-sm">{labelContent}</div>
        <div className="text-white">{value}</div>
        {subtext && <div className="text-gray-500 text-xs">{subtext}</div>}
      </div>
    </div>
  );
}

function SeeingForecastCard({
  seeingForecast,
}: {
  seeingForecast: NonNullable<NightInfo['seeingForecast']>;
}) {
  const colorClass = getSeeingForecastColorClass(seeingForecast.rating);
  const ratingLabel =
    seeingForecast.rating.charAt(0).toUpperCase() + seeingForecast.rating.slice(1);

  return (
    <div className="mt-4 rounded-lg bg-night-800 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Telescope className="h-4 w-4 text-cyan-400" />
        <Tooltip content="Seeing measures atmospheric steadiness. Good seeing = sharp stars, poor seeing = blurry, twinkling stars. Critical for planetary and high-magnification work.">
          <span className="border-gray-500 border-b border-dotted font-medium text-sm text-white">
            Seeing Forecast
          </span>
        </Tooltip>
      </div>
      <div className="flex items-center justify-between">
        <span className={`font-medium text-sm ${colorClass}`}>{ratingLabel}</span>
        <Tooltip content='FWHM (Full Width at Half Maximum) in arcseconds. Smaller = sharper stars. Under 2" is excellent, 2-3" is good, over 4" is poor.'>
          <span className="text-gray-400 text-sm">~{seeingForecast.estimatedArcsec}" FWHM</span>
        </Tooltip>
      </div>
      <p className="mt-1 text-gray-500 text-xs">{seeingForecast.recommendation}</p>
    </div>
  );
}
