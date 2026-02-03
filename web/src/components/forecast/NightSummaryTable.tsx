import { Star } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import {
  formatDate,
  formatTimeRange,
  getMoonPhaseEmoji,
  getWeatherEmoji,
} from '@/lib/utils/format';
import { calculateNightQuality } from '@/lib/weather/night-quality';
import type { NightForecast, NightWeather } from '@/types';

/**
 * Get best observation time display string
 * Shows bestTime if available, otherwise the best clearWindow
 */
function getBestTimeDisplay(weather: NightWeather | null): string | null {
  if (!weather) return null;

  // Prefer bestTime if available (calculated from scoring)
  if (weather.bestTime) {
    return formatTimeRange(weather.bestTime.start, weather.bestTime.end);
  }

  // Fall back to the longest clear window
  if (weather.clearWindows.length > 0) {
    // Sort by duration (longest first)
    const sorted = [...weather.clearWindows].sort((a, b) => {
      const durationA = a.end.getTime() - a.start.getTime();
      const durationB = b.end.getTime() - b.start.getTime();
      return durationB - durationA;
    });

    const best = sorted[0];
    const hours = Math.round((best.end.getTime() - best.start.getTime()) / (60 * 60 * 1000));
    if (hours >= 1) {
      return formatTimeRange(best.start, best.end);
    }
  }

  return null;
}

interface NightSummaryTableProps {
  forecasts: NightForecast[];
  selectedIndex: number;
  onSelectNight: (index: number) => void;
  bestNights: string[];
}

export default function NightSummaryTable({
  forecasts,
  selectedIndex,
  onSelectNight,
  bestNights,
}: NightSummaryTableProps) {
  const bestNightSet = new Set(bestNights);

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-night-700">
        <h3 className="font-semibold text-white">Observation Conditions</h3>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-night-800/50 text-left text-sm text-gray-400">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-center">
                <Tooltip content="Moon phase and illumination percentage. Less illumination = darker skies for deep-sky objects.">
                  <span className="border-b border-dotted border-gray-500">Moon</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 font-medium text-center">
                <Tooltip content="Average cloud cover percentage. Lower is better. 0-25% is ideal for observing.">
                  <span className="border-b border-dotted border-gray-500">Weather</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 font-medium">
                <Tooltip content="Optimal observation window based on cloud cover, transparency, and other conditions. Shows when to observe each night.">
                  <span className="border-b border-dotted border-gray-500">Best Window</span>
                </Tooltip>
              </th>
              <th className="px-4 py-3 font-medium text-center">
                <Tooltip content="Overall rating from 1-5 stars based on all conditions. 5 stars = excellent night for observing.">
                  <span className="border-b border-dotted border-gray-500">Rating</span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((forecast, index) => {
              const { nightInfo, weather } = forecast;
              const dateKey = nightInfo.date.toISOString().split('T')[0];
              const isBestNight = bestNightSet.has(dateKey);
              const isSelected = index === selectedIndex;
              const nightQuality = calculateNightQuality(weather, nightInfo);
              const bestTimeStr = getBestTimeDisplay(weather);

              return (
                <tr
                  key={dateKey}
                  onClick={() => onSelectNight(index)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-sky-600/20' : 'hover:bg-night-800/50'
                  } ${isBestNight ? 'border-l-2 border-l-green-500' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isBestNight && <Star className="w-4 h-4 text-green-400" />}
                      <span className="text-white font-medium">{formatDate(nightInfo.date)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-lg">{getMoonPhaseEmoji(nightInfo.moonPhase)}</span>
                    <span className="text-xs text-gray-400 ml-1">
                      {Math.round(nightInfo.moonIllumination)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {weather ? (
                      <>
                        <span className="text-lg">{getWeatherEmoji(weather.avgCloudCover)}</span>
                        <span className="text-xs text-gray-400 ml-1">
                          {Math.round(weather.avgCloudCover)}%
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {bestTimeStr ? (
                      <span className="text-green-400">{bestTimeStr}</span>
                    ) : (
                      <span className="text-gray-500">No good window</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`star-rating text-sm ${nightQuality.rating.color}`}>
                      {nightQuality.rating.starString}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden divide-y divide-night-700">
        {forecasts.map((forecast, index) => {
          const { nightInfo, weather } = forecast;
          const dateKey = nightInfo.date.toISOString().split('T')[0];
          const isBestNight = bestNightSet.has(dateKey);
          const isSelected = index === selectedIndex;
          const nightQuality = calculateNightQuality(weather, nightInfo);
          const bestTimeStr = getBestTimeDisplay(weather);

          return (
            <div
              key={dateKey}
              role="button"
              tabIndex={0}
              onClick={() => onSelectNight(index)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectNight(index);
                }
              }}
              className={`p-4 cursor-pointer transition-colors ${
                isSelected ? 'bg-sky-600/20' : ''
              } ${isBestNight ? 'border-l-2 border-l-green-500' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isBestNight && <Star className="w-4 h-4 text-green-400" />}
                  <span className="text-white font-medium">{formatDate(nightInfo.date)}</span>
                </div>
                <span className={`star-rating text-sm ${nightQuality.rating.color}`}>
                  {nightQuality.rating.starString}
                </span>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  {getMoonPhaseEmoji(nightInfo.moonPhase)}
                  {Math.round(nightInfo.moonIllumination)}%
                </span>
                {weather && (
                  <span className="flex items-center gap-1">
                    {getWeatherEmoji(weather.avgCloudCover)}
                    {Math.round(weather.avgCloudCover)}%
                  </span>
                )}
                {bestTimeStr ? (
                  <span className="text-green-400">{bestTimeStr}</span>
                ) : (
                  <span className="text-gray-500">No window</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
