import {
  ChevronDown,
  ChevronUp,
  CloudSun,
  Droplets,
  Eye,
  Star,
  Telescope,
  Wind,
} from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="w-5 h-5 text-yellow-400" />
            <div>
              <h3 className="font-semibold text-white">Tonight's Rating</h3>
              <p className="text-sm text-gray-400">{nightQuality.summary}</p>
              {weather?.bestTime && (
                <p className="text-sm text-green-400 mt-1">
                  Best: {formatTime(weather.bestTime.start)} – {formatTime(weather.bestTime.end)}
                </p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${nightQuality.rating.color}`}>
              {nightQuality.rating.starString}
            </div>
            <div className={`text-sm ${nightQuality.rating.color}`}>
              {nightQuality.rating.label}
            </div>
          </div>
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
              <div>
                <div className="text-3xl mb-1">{getWeatherEmoji(weather.avgCloudCover)}</div>
                <div className="text-sm text-gray-400">
                  {getWeatherDescription(weather.avgCloudCover)}
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(weather.avgCloudCover)}% clouds
                </div>
              </div>

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

              {weather.avgWindSpeedKmh !== null && (
                <div>
                  <div className="flex items-center justify-center text-2xl text-sky-400 mb-1">
                    <Wind className="w-8 h-8" />
                  </div>
                  <div className="text-sm text-gray-400">
                    {Math.round(weather.avgWindSpeedKmh)} km/h
                  </div>
                  <div className="text-xs text-gray-500">Avg wind</div>
                </div>
              )}

              {weather.avgHumidity !== null && (
                <div>
                  <div className="flex items-center justify-center text-2xl text-blue-400 mb-1">
                    <Droplets className="w-8 h-8" />
                  </div>
                  <div className="text-sm text-gray-400">{Math.round(weather.avgHumidity)}%</div>
                  <div className="text-xs text-gray-500">Humidity</div>
                </div>
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
                  />
                )}

                {weather.maxPrecipProbability !== null && (
                  <DetailRow
                    icon={<Droplets className="w-4 h-4" />}
                    label="Precipitation"
                    value={`${weather.maxPrecipProbability}%`}
                    subtext="Max probability"
                  />
                )}

                {weather.avgTemperatureC !== null && (
                  <DetailRow
                    icon={<span className="text-sm">🌡️</span>}
                    label="Temperature"
                    value={`${Math.round(weather.avgTemperatureC)}°C`}
                  />
                )}

                {weather.dewRiskHours > 0 && (
                  <div className="sm:col-span-2">
                    <DetailRow
                      icon={<span className="text-sm">💧</span>}
                      label="Dew Risk"
                      value={`${weather.dewRiskHours}h`}
                      subtext="Hours with dew risk"
                      warning
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
                  />
                )}

                {nightInfo.localSiderealTimeAtMidnight && (
                  <DetailRow
                    icon={<span className="text-sm">🌟</span>}
                    label="LST at Midnight"
                    value={nightInfo.localSiderealTimeAtMidnight}
                    subtext="Local Sidereal Time"
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  warning?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`text-gray-400 ${warning ? 'text-amber-400' : ''}`}>{icon}</div>
      <div>
        <div className="text-sm text-gray-400">{label}</div>
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
        <span className="text-sm font-medium text-white">Seeing Forecast</span>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${colorClass}`}>{ratingLabel}</span>
        <span className="text-sm text-gray-400">~{seeingForecast.estimatedArcsec}" FWHM</span>
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
 * Calculate dew risk for a single hour
 */
function calculateHourDewRisk(
  weather: NightWeather,
  actualHour: number
): 'safe' | 'low' | 'moderate' | 'high' {
  const hourData = weather.hourlyData.get(actualHour);
  if (!hourData) return 'safe';

  const temp = hourData.temperature ?? 15;
  const dewPoint = hourData.dewPoint ?? 10;
  const margin = temp - dewPoint;

  return getDewRiskLevel(margin);
}

function DewTimeline({
  weather,
  nightInfo,
}: {
  weather: NightForecast['weather'];
  nightInfo: NightForecast['nightInfo'];
}) {
  if (!weather || !weather.hourlyData) return null;

  const startHour = nightInfo.sunset.getHours();
  const endHour = nightInfo.sunrise.getHours() + 24;

  const hours: Array<{
    hour: number;
    displayHour: string;
    riskLevel: 'safe' | 'low' | 'moderate' | 'high';
  }> = [];

  for (let h = startHour; h <= endHour && hours.length < 12; h++) {
    const actualHour = h % 24;
    hours.push({
      hour: actualHour,
      displayHour: formatDisplayHour(actualHour),
      riskLevel: calculateHourDewRisk(weather, actualHour),
    });
  }

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {hours.map(h => (
          <div key={h.hour} className="flex-1 text-center">
            <div
              className={`h-3 rounded ${getDewRiskColorClass(h.riskLevel)}`}
              title={`${h.hour}:00 - ${h.riskLevel} dew risk`}
            />
            <div className="text-[10px] text-gray-500 mt-1">{h.displayHour}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-500">
        <span>PM</span>
        <span>AM</span>
      </div>
    </div>
  );
}
