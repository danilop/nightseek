import { ChevronDown, ChevronUp, CloudSun, Droplets, Eye, Telescope, Wind } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import {
  getMoonPhaseEmoji as getExactMoonPhaseEmoji,
  getMoonPhaseName as getExactMoonPhaseName,
} from '@/lib/astronomy/moon-phases';
import {
  formatTime,
  getMoonPhaseEmoji,
  getMoonPhaseName,
  getWeatherDescription,
  getWeatherEmoji,
} from '@/lib/utils/format';
import { getDewRiskLevel, getSeeingForecastColorClass } from '@/lib/utils/quality-helpers';
import { calculateNightQuality } from '@/lib/weather/night-quality';
import type { NightForecast, NightInfo, NightWeather } from '@/types';

interface NightDetailsProps {
  forecast: NightForecast;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: UI component with multiple conditional sections
export default function NightDetails({ forecast }: NightDetailsProps) {
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);
  const { nightInfo, weather } = forecast;

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
              Tonight's Rating
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
          {weather?.bestTime && (
            <p className="text-sm text-green-400">
              <Tooltip content="Optimal window with lowest cloud cover, best transparency, and minimal dew risk.">
                Best:
              </Tooltip>{' '}
              <span className="whitespace-nowrap">{formatTime(weather.bestTime.start)}</span>
              {' – '}
              <span className="whitespace-nowrap">{formatTime(weather.bestTime.end)}</span>
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
              <Tooltip content="Average cloud cover during the night. Lower is better for observing. 0-25% is ideal.">
                <div>
                  <div className="text-3xl mb-1">{getWeatherEmoji(weather.avgCloudCover)}</div>
                  <div className="text-sm text-gray-400">
                    {getWeatherDescription(weather.avgCloudCover)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.round(weather.avgCloudCover)}% clouds
                  </div>
                </div>
              </Tooltip>

              <Tooltip content="Moon phase affects sky brightness. New moon is best for deep-sky objects. Full moon is good for lunar and planetary observation.">
                <div>
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
                </div>
              </Tooltip>

              {weather.avgWindSpeedKmh !== null && (
                <Tooltip content="Average wind speed. High winds (>20 km/h) cause telescope shake and poor seeing. Calm conditions are ideal.">
                  <div>
                    <div className="flex items-center justify-center text-2xl text-sky-400 mb-1">
                      <Wind className="w-8 h-8" />
                    </div>
                    <div className="text-sm text-gray-400">
                      {Math.round(weather.avgWindSpeedKmh)} km/h
                    </div>
                    <div className="text-xs text-gray-500">Avg wind</div>
                  </div>
                </Tooltip>
              )}

              {weather.avgHumidity !== null && (
                <Tooltip content="Average humidity. High humidity (>80%) increases dew risk and can affect transparency.">
                  <div>
                    <div className="flex items-center justify-center text-2xl text-blue-400 mb-1">
                      <Droplets className="w-8 h-8" />
                    </div>
                    <div className="text-sm text-gray-400">{Math.round(weather.avgHumidity)}%</div>
                    <div className="text-xs text-gray-500">Humidity</div>
                  </div>
                </Tooltip>
              )}
            </div>

            {/* Seeing Forecast */}
            {nightInfo.seeingForecast && (
              <SeeingForecastCard seeingForecast={nightInfo.seeingForecast} />
            )}

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
                    value={`${Math.round(weather.avgTemperatureC)}°C`}
                    tooltip="Average air temperature during the night. Colder temperatures increase dew risk but can improve seeing."
                  />
                )}

                {weather.dewRiskHours > 0 && (
                  <div className="sm:col-span-2">
                    <DetailRow
                      icon={<span className="text-sm">💧</span>}
                      label="Dew Risk"
                      value={`${weather.dewRiskHours}h`}
                      subtext={
                        weather.minDewMargin !== null
                          ? `Min margin: ${weather.minDewMargin.toFixed(1)}°C`
                          : 'Hours with dew risk'
                      }
                      warning
                      tooltip="Hours when dew may form on equipment. Margin is the gap between air temp and dew point. Use a dew heater when margin drops below 4°C."
                    />
                    {/* Dew Timeline */}
                    <DewTimeline weather={weather} nightInfo={nightInfo} />
                  </div>
                )}

                {weather.pressureTrend && (
                  <DetailRow
                    icon={<span className="text-sm">📊</span>}
                    label="Pressure"
                    value={
                      weather.avgPressureHpa ? `${Math.round(weather.avgPressureHpa)} hPa` : '—'
                    }
                    subtext={`Trend: ${weather.pressureTrend}`}
                    tooltip="Atmospheric pressure. Stable or rising pressure usually means clearer, more stable skies. Falling pressure often indicates incoming weather."
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
                          {formatTime(window.start)} - {formatTime(window.end)}
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
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  warning?: boolean;
  tooltip?: string;
}) {
  const labelContent = tooltip ? (
    <Tooltip content={tooltip}>
      <span className="border-b border-dotted border-gray-500">{label}</span>
    </Tooltip>
  ) : (
    label
  );

  return (
    <div className="flex items-start gap-3">
      <div className={`text-gray-400 ${warning ? 'text-amber-400' : ''}`}>{icon}</div>
      <div>
        <div className="text-sm text-gray-400">{labelContent}</div>
        <div className={`text-white ${warning ? 'text-amber-400' : ''}`}>{value}</div>
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

/**
 * Get display hour string from actual hour
 */
function formatDisplayHour(actualHour: number): string {
  if (actualHour === 0) return '12';
  if (actualHour > 12) return `${actualHour - 12}`;
  return `${actualHour}`;
}

/**
 * Get dew risk color class for timeline
 */
function getDewRiskColorClass(riskLevel: 'safe' | 'low' | 'moderate' | 'high'): string {
  switch (riskLevel) {
    case 'safe':
      return 'bg-green-500/40';
    case 'low':
      return 'bg-yellow-500/40';
    case 'moderate':
      return 'bg-orange-500/40';
    case 'high':
      return 'bg-red-500/60';
  }
}

/**
 * Get hourly dew data for timeline
 */
function getHourDewData(
  weather: NightWeather,
  actualHour: number
): {
  temp: number | null;
  dewPoint: number | null;
  margin: number | null;
  riskLevel: 'safe' | 'low' | 'moderate' | 'high';
} {
  const hourData = weather.hourlyData.get(actualHour);
  if (!hourData) return { temp: null, dewPoint: null, margin: null, riskLevel: 'safe' };

  const temp = hourData.temperature;
  const dewPoint = hourData.dewPoint;
  const margin = temp !== null && dewPoint !== null ? temp - dewPoint : null;
  const riskLevel = margin !== null ? getDewRiskLevel(margin) : 'safe';

  return { temp, dewPoint, margin, riskLevel };
}

/**
 * Hook to get responsive hour count for dew timeline
 */
function useResponsiveHourCount(): number {
  const [hourCount, setHourCount] = useState(8); // Default to mobile

  useEffect(() => {
    const updateHourCount = () => {
      // 640px is Tailwind's 'sm' breakpoint
      setHourCount(window.innerWidth >= 640 ? 12 : 8);
    };

    updateHourCount();
    window.addEventListener('resize', updateHourCount);
    return () => window.removeEventListener('resize', updateHourCount);
  }, []);

  return hourCount;
}

function DewTimeline({
  weather,
  nightInfo,
}: {
  weather: NightForecast['weather'];
  nightInfo: NightForecast['nightInfo'];
}) {
  const maxHours = useResponsiveHourCount();

  if (!weather || !weather.hourlyData) return null;

  const startHour = nightInfo.sunset.getHours();
  const endHour = nightInfo.sunrise.getHours() + 24;

  const hours: Array<{
    hour: number;
    displayHour: string;
    temp: number | null;
    dewPoint: number | null;
    margin: number | null;
    riskLevel: 'safe' | 'low' | 'moderate' | 'high';
  }> = [];

  for (let h = startHour; h <= endHour && hours.length < maxHours; h++) {
    const actualHour = h % 24;
    const dewData = getHourDewData(weather, actualHour);
    hours.push({
      hour: actualHour,
      displayHour: formatDisplayHour(actualHour),
      ...dewData,
    });
  }

  return (
    <div className="mt-2">
      {/* Timeline bars */}
      <div className="flex items-center gap-1">
        <span className="w-4" />
        {hours.map(h => (
          <div key={h.hour} className="flex-1 text-center">
            <div
              className={`h-3 rounded ${getDewRiskColorClass(h.riskLevel)}`}
              title={
                h.temp !== null && h.dewPoint !== null
                  ? `${h.hour}:00 – Temp: ${Math.round(h.temp)}°C, Dew: ${Math.round(h.dewPoint)}°C (${h.margin !== null ? `${h.margin.toFixed(1)}°C margin` : ''})`
                  : `${h.hour}:00 - ${h.riskLevel} dew risk`
              }
            />
          </div>
        ))}
      </div>

      {/* Temp row */}
      <div className="flex items-center gap-1 mt-1">
        <Tooltip content="Air temperature in °C. Dew forms when this drops close to the dew point.">
          <span className="w-4 text-[10px]">🌡️</span>
        </Tooltip>
        {hours.map(h => (
          <div key={`temp-${h.hour}`} className="flex-1 text-center">
            <div className="text-[9px] text-gray-400">
              {h.temp !== null ? `${Math.round(h.temp)}°` : '–'}
            </div>
          </div>
        ))}
      </div>

      {/* Dew point row */}
      <div className="flex items-center gap-1">
        <Tooltip content="Dew point: temperature at which moisture condenses. When air temp approaches this, dew forms on equipment.">
          <span className="w-4 text-[10px]">💧</span>
        </Tooltip>
        {hours.map(h => (
          <div key={`dew-${h.hour}`} className="flex-1 text-center">
            <div className="text-[9px] text-blue-400/70">
              {h.dewPoint !== null ? `${Math.round(h.dewPoint)}°` : '–'}
            </div>
          </div>
        ))}
      </div>

      {/* Hour labels */}
      <div className="flex items-center gap-1 mt-0.5">
        <span className="w-4" />
        {hours.map(h => (
          <div key={`hour-${h.hour}`} className="flex-1 text-center">
            <div className="text-[10px] text-gray-500">{h.displayHour}</div>
          </div>
        ))}
      </div>

      {/* PM/AM and Legend */}
      <div className="flex justify-between items-center mt-1">
        <span className="text-[10px] text-gray-500">PM</span>
        <Tooltip content="Margin = Temp minus Dew point. Below 2°C: high dew risk, use a dew heater. Above 6°C: safe.">
          <div className="flex items-center gap-2 text-[9px] text-gray-500">
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded bg-green-500/40" /> &gt;6°
            </span>
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded bg-yellow-500/40" /> 4-6°
            </span>
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded bg-orange-500/40" /> 2-4°
            </span>
            <span className="flex items-center gap-0.5">
              <span className="w-2 h-2 rounded bg-red-500/60" /> &lt;2°
            </span>
          </div>
        </Tooltip>
        <span className="text-[10px] text-gray-500">AM</span>
      </div>
    </div>
  );
}
