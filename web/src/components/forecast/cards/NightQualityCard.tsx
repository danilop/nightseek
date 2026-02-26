import { Info } from 'lucide-react';
import { useMemo } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import { formatTime, formatTimeRange, getNightLabel } from '@/lib/utils/format';
import { calculateNightQuality } from '@/lib/weather/night-quality';
import type { NightForecast, NightInfo } from '@/types';

function formatDarkHours(dusk: Date, dawn: Date): string {
  const hours = (dawn.getTime() - dusk.getTime()) / 3_600_000;
  return `${hours.toFixed(1)}h`;
}

/** Fraction of the sunset→sunrise span at which a time falls (clamped 0–1). */
function nightFraction(time: Date, sunset: Date, sunrise: Date): number {
  const total = sunrise.getTime() - sunset.getTime();
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, (time.getTime() - sunset.getTime()) / total));
}

function NightTimelineBar({ nightInfo }: { nightInfo: NightInfo }) {
  const duskPct =
    nightFraction(nightInfo.astronomicalDusk, nightInfo.sunset, nightInfo.sunrise) * 100;
  const dawnPct =
    nightFraction(nightInfo.astronomicalDawn, nightInfo.sunset, nightInfo.sunrise) * 100;

  return (
    <div
      className="h-5 w-full overflow-hidden rounded-full ring-1 ring-white/10"
      style={{
        background: `linear-gradient(to right,
          #ea580c 0%,
          #ea580c ${duskPct * 0.6}%,
          #818cf8 ${duskPct}%,
          #6366f1 ${(duskPct + dawnPct) / 2}%,
          #818cf8 ${dawnPct}%,
          #ea580c ${100 - (100 - dawnPct) * 0.6}%,
          #ea580c 100%)`,
      }}
    />
  );
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

        {/* Night timeline */}
        <div className="rounded-lg bg-night-800 p-3">
          {/* Time labels row */}
          <div className="mb-2 flex items-baseline justify-between text-xs">
            <Tooltip content="Sunset — start of the night period.">
              <span className="text-orange-400">{formatTime(nightInfo.sunset)}</span>
            </Tooltip>
            <Tooltip content="Astronomical dusk — sun 18° below horizon, true darkness begins.">
              <span className="text-indigo-400">{formatTime(nightInfo.astronomicalDusk)}</span>
            </Tooltip>
            <span className="font-medium text-indigo-300">
              {formatDarkHours(nightInfo.astronomicalDusk, nightInfo.astronomicalDawn)}
            </span>
            <Tooltip content="Astronomical dawn — sun rises to 18° below horizon, sky begins brightening.">
              <span className="text-indigo-400">{formatTime(nightInfo.astronomicalDawn)}</span>
            </Tooltip>
            <Tooltip content="Sunrise — end of the night period.">
              <span className="text-orange-400">{formatTime(nightInfo.sunrise)}</span>
            </Tooltip>
          </div>

          {/* Visual bar */}
          <NightTimelineBar nightInfo={nightInfo} />

          {/* Legend */}
          <div className="mt-1.5 flex items-center justify-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-orange-700" /> Twilight
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" /> Dark sky
            </span>
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
