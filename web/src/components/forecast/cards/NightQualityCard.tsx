import { Info, Moon, Sunset } from 'lucide-react';
import { useMemo } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import { formatTimeRange, getNightLabel } from '@/lib/utils/format';
import { calculateNightQuality } from '@/lib/weather/night-quality';
import type { NightForecast } from '@/types';

function formatDarkHours(dusk: Date, dawn: Date): string {
  const hours = (dawn.getTime() - dusk.getTime()) / 3_600_000;
  return `${hours.toFixed(1)}h`;
}

interface NightQualityCardProps {
  forecast: NightForecast;
}

export default function NightQualityCard({ forecast }: NightQualityCardProps) {
  const { nightInfo, weather } = forecast;

  const nightQuality = useMemo(
    () => calculateNightQuality(weather, nightInfo),
    [weather, nightInfo]
  );

  return (
    <div className="rounded-xl border border-night-700 bg-night-900 p-4">
      <div className="space-y-2">
        <h3 className="font-semibold text-white">
          <Tooltip content="Overall rating based on cloud cover, moon phase, transparency, seeing conditions, and dew risk.">
            <span>{getNightLabel(nightInfo.date, true)} Rating</span>
          </Tooltip>
        </h3>
        <div className={`flex items-center gap-2 font-bold text-xl ${nightQuality.rating.color}`}>
          <Tooltip content="5 stars = Excellent, 4 = Very Good, 3 = Good, 2 = Fair, 1 = Poor. Based on weighted scoring of all conditions.">
            <span>{nightQuality.rating.starString}</span>
          </Tooltip>
          <span>{nightQuality.rating.label}</span>
        </div>
        <p className="text-gray-400 text-sm">{nightQuality.summary}</p>

        {/* Sun & astronomical night times */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Sunset className="h-3.5 w-3.5 text-orange-400" />
            <Tooltip content="Sunset to sunrise — the full night period.">
              <span className="border-gray-600 border-b border-dotted">
                {formatTimeRange(nightInfo.sunset, nightInfo.sunrise)}
              </span>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400">
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
            <Tooltip content="Astronomical night: sun is 18° or more below the horizon. Darkest period, ideal for deep-sky observation.">
              <span className="border-gray-600 border-b border-dotted">
                {formatTimeRange(nightInfo.astronomicalDusk, nightInfo.astronomicalDawn)}
              </span>
            </Tooltip>
          </div>
          <div className="text-gray-600 text-xs">Sunset – Sunrise</div>
          <div className="text-gray-600 text-xs">
            Dark sky · {formatDarkHours(nightInfo.astronomicalDusk, nightInfo.astronomicalDawn)}
          </div>
        </div>

        {forecast.forecastConfidence === 'low' && (
          <div className="flex items-start gap-2 text-amber-400 text-sm">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Based on celestial conditions only. Weather data is not available beyond 16 days.
            </span>
          </div>
        )}
        {forecast.forecastConfidence === 'medium' && (
          <p className="text-gray-500 text-xs">Air quality data unavailable beyond 5 days</p>
        )}
        {weather?.bestTime ? (
          <p className="text-green-400 text-sm">
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
          <p className="text-gray-500 text-sm">
            <Tooltip content="No window with acceptable conditions (low clouds, good transparency, minimal dew risk) found.">
              <span>No good observation window</span>
            </Tooltip>
          </p>
        )}
      </div>
    </div>
  );
}
