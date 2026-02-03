import { ChevronDown, ChevronUp, CloudSun, Droplets, Eye, Telescope, Wind } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
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
  getNightLabel,
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
import { calculateNightQuality } from '@/lib/weather/night-quality';
import { useApp } from '@/stores/AppContext';
import type { NightForecast, NightInfo } from '@/types';
import HourlyConditionsTimeline from './HourlyConditionsTimeline';

interface NightDetailsProps {
  forecast: NightForecast;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI component with multiple conditional sections
export default function NightDetails({ forecast }: NightDetailsProps) {
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);
  const { nightInfo, weather } = forecast;
  const { state } = useApp();
  const { units } = state.settings;

  // Calculate overall night quality
  const nightQuality = useMemo(
    () => calculateNightQuality(weather, nightInfo),
    [weather, nightInfo]
  );

  return (
    <div className="space-y-4">
      {/* Overall Night Quality Rating */}
      <div className="bg-night-900 rounded-xl border border-night-700 p-4">
        <div className="space-y-2">
          {/* Title */}
          <h3 className="font-semibold text-white">
            <Tooltip content="Overall rating based on cloud cover, moon phase, transparency, seeing conditions, and dew risk.">
              <span>{getNightLabel(nightInfo.date, true)} Rating</span>
            </Tooltip>
          </h3>
          {/* Stars and rating label */}
          <div className={`flex items-center gap-2 text-xl font-bold ${nightQuality.rating.color}`}>
            <Tooltip content="5 stars = Excellent, 4 = Very Good, 3 = Good, 2 = Fair, 1 = Poor. Based on weighted scoring of all conditions.">
              <span>{nightQuality.rating.starString}</span>
            </Tooltip>
            <span>{nightQuality.rating.label}</span>
          </div>
          {/* Summary description */}
          <p className="text-sm text-gray-400">{nightQuality.summary}</p>
          {/* Best observation time */}
          {weather?.bestTime ? (
            <p className="text-sm text-green-400">
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
            <p className="text-sm text-gray-500">
              <Tooltip content="No window with acceptable conditions (low clouds, good transparency, minimal dew risk) found.">
                <span>No good observation window</span>
              </Tooltip>
            </p>
          )}
        </div>
      </div>

      {/* Weather Details Card */}
      {weather && (
        <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
          <button
            type="button"
            className="w-full px-4 py-3 border-b border-night-700 flex items-center justify-between"
            onClick={() => setShowWeatherDetails(!showWeatherDetails)}
          >
            <h3 className="font-semibold text-white flex items-center gap-2">
              <CloudSun className="w-4 h-4 text-sky-400" />
              Weather Conditions
            </h3>
            {showWeatherDetails ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          <div className="p-4">
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="cursor-help">
                <Tooltip content="Average cloud cover during the night. Lower is better for observing. 0-25% is ideal.">
                  <span className="block">
                    <div className="text-3xl mb-1">{getWeatherEmoji(weather.avgCloudCover)}</div>
                    <div className="text-sm text-gray-400">
                      {getWeatherDescription(weather.avgCloudCover)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {Math.round(weather.avgCloudCover)}% clouds
                    </div>
                  </span>
                </Tooltip>
              </div>

              <div className="cursor-help">
                <Tooltip content="Moon phase affects sky brightness. New moon is best for deep-sky objects. Full moon is good for lunar and planetary observation.">
                  <span className="block">
                    <div className="text-3xl mb-1">
                      {nightInfo.moonPhaseExact
                        ? getExactMoonPhaseEmoji(nightInfo.moonPhaseExact.phase)
                        : getMoonPhaseEmoji(nightInfo.moonPhase)}
                    </div>
                    <div className="text-sm text-gray-400">
                      {nightInfo.moonPhaseExact
                        ? getExactMoonPhaseName(nightInfo.moonPhaseExact.phase)
                        : getMoonPhaseName(nightInfo.moonPhase)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {nightInfo.moonPhaseExact?.isTonight
                        ? `at ${formatTime(nightInfo.moonPhaseExact.time)}`
                        : `${Math.round(nightInfo.moonIllumination)}% illuminated`}
                    </div>
                  </span>
                </Tooltip>
              </div>

              {weather.avgWindSpeedKmh !== null && (
                <div className="cursor-help">
                  <Tooltip content="Average wind speed. High winds cause telescope shake and poor seeing. Calm conditions are ideal.">
                    <span className="block">
                      <div className="flex items-center justify-center text-2xl text-sky-400 mb-1">
                        <Wind className="w-8 h-8" />
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatSpeed(weather.avgWindSpeedKmh, units.speed)}
                      </div>
                      <div className="text-xs text-gray-500">Avg wind</div>
                    </span>
                  </Tooltip>
                </div>
              )}

              {weather.avgHumidity !== null && (
                <div className="cursor-help">
                  <Tooltip content="Average humidity. High humidity increases dew risk and can affect transparency.">
                    <span className="block">
                      <div className="flex items-center justify-center text-2xl text-blue-400 mb-1">
                        <Droplets className="w-8 h-8" />
                      </div>
                      <div className="text-sm text-gray-400">
                        {Math.round(weather.avgHumidity)}%
                      </div>
                      <div className="text-xs text-gray-500">Humidity</div>
                    </span>
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Seeing Forecast */}
            {nightInfo.seeingForecast && (
              <SeeingForecastCard seeingForecast={nightInfo.seeingForecast} />
            )}

            {/* Hourly Conditions Timeline - Always visible */}
            <HourlyConditionsTimeline weather={weather} temperatureUnit={units.temperature} />

            {/* Expanded Details */}
            {showWeatherDetails && (
              <div className="mt-4 pt-4 border-t border-night-700 grid sm:grid-cols-2 gap-4">
                {weather.transparencyScore !== null && (
                  <DetailRow
                    icon={<Eye className="w-4 h-4" />}
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
                    icon={<Droplets className="w-4 h-4" />}
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
                    <div className="text-sm text-gray-400 mb-2">Clear Windows</div>
                    <div className="flex flex-wrap gap-2">
                      {weather.clearWindows.map(window => (
                        <span
                          key={`${window.start.getTime()}-${window.end.getTime()}`}
                          className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs"
                        >
                          {formatTimeRange(window.start, window.end)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  subtext,
  warning = false,
  safe = false,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  warning?: boolean;
  safe?: boolean;
  tooltip?: string;
}) {
  const labelContent = tooltip ? (
    <Tooltip content={tooltip}>
      <span className="border-b border-dotted border-gray-500">{label}</span>
    </Tooltip>
  ) : (
    label
  );

  const valueColor = warning ? 'text-amber-400' : safe ? 'text-green-400' : 'text-white';
  const iconColor = warning ? 'text-amber-400' : safe ? 'text-green-400' : 'text-gray-400';

  return (
    <div className="flex items-start gap-3">
      <div className={iconColor}>{icon}</div>
      <div>
        <div className="text-sm text-gray-400">{labelContent}</div>
        <div className={valueColor}>{value}</div>
        {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
      </div>
    </div>
  );
}

/**
 * Seeing Forecast card component
 */
function SeeingForecastCard({
  seeingForecast,
}: {
  seeingForecast: NonNullable<NightInfo['seeingForecast']>;
}) {
  const colorClass = getSeeingForecastColorClass(seeingForecast.rating);
  const ratingLabel =
    seeingForecast.rating.charAt(0).toUpperCase() + seeingForecast.rating.slice(1);

  return (
    <div className="mt-4 p-3 bg-night-800 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Telescope className="w-4 h-4 text-cyan-400" />
        <Tooltip content="Seeing measures atmospheric steadiness. Good seeing = sharp stars, poor seeing = blurry, twinkling stars. Critical for planetary and high-magnification work.">
          <span className="text-sm font-medium text-white border-b border-dotted border-gray-500">
            Seeing Forecast
          </span>
        </Tooltip>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${colorClass}`}>{ratingLabel}</span>
        <Tooltip content='FWHM (Full Width at Half Maximum) in arcseconds. Smaller = sharper stars. Under 2" is excellent, 2-3" is good, over 4" is poor.'>
          <span className="text-sm text-gray-400">~{seeingForecast.estimatedArcsec}" FWHM</span>
        </Tooltip>
      </div>
      <p className="text-xs text-gray-500 mt-1">{seeingForecast.recommendation}</p>
    </div>
  );
}
