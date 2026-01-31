import React, { useState } from 'react';
import { ChevronDown, ChevronUp, CloudSun, Wind, Droplets, Eye } from 'lucide-react';
import type { NightForecast } from '@/types';
import {
  formatTime,
  getMoonPhaseEmoji,
  getMoonPhaseName,
  getWeatherEmoji,
  getWeatherDescription,
} from '@/lib/utils/format';

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
                <div className="text-3xl mb-1">
                  {getWeatherEmoji(weather.avgCloudCover)}
                </div>
                <div className="text-sm text-gray-400">
                  {getWeatherDescription(weather.avgCloudCover)}
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(weather.avgCloudCover)}% clouds
                </div>
              </div>

              <div>
                <div className="text-3xl mb-1">
                  {getMoonPhaseEmoji(nightInfo.moonPhase)}
                </div>
                <div className="text-sm text-gray-400">
                  {getMoonPhaseName(nightInfo.moonPhase)}
                </div>
                <div className="text-xs text-gray-500">
                  {Math.round(nightInfo.moonIllumination)}% illuminated
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
                  <div className="text-sm text-gray-400">
                    {Math.round(weather.avgHumidity)}%
                  </div>
                  <div className="text-xs text-gray-500">Humidity</div>
                </div>
              )}
            </div>

            {/* Expanded Details */}
            {showWeatherDetails && (
              <div className="mt-4 pt-4 border-t border-night-700 grid sm:grid-cols-2 gap-4">
                {weather.transparencyScore !== null && (
                  <DetailRow
                    icon={<Eye className="w-4 h-4" />}
                    label="Transparency"
                    value={`${Math.round(weather.transparencyScore)}%`}
                    subtext={weather.avgAerosolOpticalDepth !== null
                      ? `AOD: ${weather.avgAerosolOpticalDepth.toFixed(3)}`
                      : undefined}
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
                  <DetailRow
                    icon={<span className="text-sm">💧</span>}
                    label="Dew Risk"
                    value={`${weather.dewRiskHours}h`}
                    subtext="Hours with dew risk"
                    warning
                  />
                )}

                {weather.pressureTrend && (
                  <DetailRow
                    icon={<span className="text-sm">📊</span>}
                    label="Pressure"
                    value={weather.avgPressureHpa ? `${Math.round(weather.avgPressureHpa)} hPa` : '—'}
                    subtext={`Trend: ${weather.pressureTrend}`}
                  />
                )}

                {weather.clearWindows.length > 0 && (
                  <div className="sm:col-span-2">
                    <div className="text-sm text-gray-400 mb-2">Clear Windows</div>
                    <div className="flex flex-wrap gap-2">
                      {weather.clearWindows.map((window, i) => (
                        <span
                          key={i}
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
      <div className={`text-gray-400 ${warning ? 'text-amber-400' : ''}`}>
        {icon}
      </div>
      <div>
        <div className="text-sm text-gray-400">{label}</div>
        <div className={`text-white ${warning ? 'text-amber-400' : ''}`}>
          {value}
        </div>
        {subtext && <div className="text-xs text-gray-500">{subtext}</div>}
      </div>
    </div>
  );
}

