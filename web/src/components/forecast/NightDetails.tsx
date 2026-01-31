import { ChevronDown, ChevronUp, CloudSun, Droplets, Eye, Telescope, Wind } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
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
import type { NightForecast } from '@/types';

interface NightDetailsProps {
  forecast: NightForecast;
}

export default function NightDetails({ forecast }: NightDetailsProps) {
  const [showWeatherDetails, setShowWeatherDetails] = useState(false);
  const { nightInfo, weather } = forecast;

  return (
    <div className="space-y-4">
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
              <div className="mt-4 p-3 bg-night-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Telescope className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">Seeing Forecast</span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-medium ${
                      nightInfo.seeingForecast.rating === 'excellent'
                        ? 'text-green-400'
                        : nightInfo.seeingForecast.rating === 'good'
                          ? 'text-blue-400'
                          : nightInfo.seeingForecast.rating === 'fair'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                    }`}
                  >
                    {nightInfo.seeingForecast.rating.charAt(0).toUpperCase() +
                      nightInfo.seeingForecast.rating.slice(1)}
                  </span>
                  <span className="text-sm text-gray-400">
                    ~{nightInfo.seeingForecast.estimatedArcsec}" FWHM
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {nightInfo.seeingForecast.recommendation}
                </p>
              </div>
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

function DewTimeline({
  weather,
  nightInfo,
}: {
  weather: NightForecast['weather'];
  nightInfo: NightForecast['nightInfo'];
}) {
  if (!weather || !weather.hourlyData) return null;

  // Get hours from sunset to sunrise
  const startHour = nightInfo.sunset.getHours();
  const endHour = nightInfo.sunrise.getHours() + 24; // Add 24 to handle overnight

  const hours: Array<{
    hour: number;
    displayHour: string;
    riskLevel: 'safe' | 'low' | 'moderate' | 'high';
  }> = [];

  for (let h = startHour; h <= endHour && hours.length < 12; h++) {
    const actualHour = h % 24;
    const hourData = weather.hourlyData.get(actualHour);

    let riskLevel: 'safe' | 'low' | 'moderate' | 'high' = 'safe';

    if (hourData) {
      const temp = hourData.temperature ?? 15;
      const dewPoint = hourData.dewPoint ?? 10;
      const margin = temp - dewPoint;

      if (margin < 2) riskLevel = 'high';
      else if (margin < 4) riskLevel = 'moderate';
      else if (margin < 6) riskLevel = 'low';
    }

    hours.push({
      hour: actualHour,
      displayHour:
        actualHour > 12 ? `${actualHour - 12}` : actualHour === 0 ? '12' : `${actualHour}`,
      riskLevel,
    });
  }

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {hours.map(h => (
          <div key={h.hour} className="flex-1 text-center">
            <div
              className={`h-3 rounded ${
                h.riskLevel === 'safe'
                  ? 'bg-green-500/40'
                  : h.riskLevel === 'low'
                    ? 'bg-yellow-500/40'
                    : h.riskLevel === 'moderate'
                      ? 'bg-orange-500/40'
                      : 'bg-red-500/60'
              }`}
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
