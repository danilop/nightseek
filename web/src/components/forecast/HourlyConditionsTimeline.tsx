import { toZonedTime } from 'date-fns-tz';
import { Cloud, Droplets } from 'lucide-react';
import { useMemo } from 'react';
import { getQualityBgColor, type QualityLevel } from '@/lib/utils/colors';
import { formatTemperature } from '@/lib/utils/units';
import type { HourlyWeather, NightWeather, TemperatureUnit } from '@/types';

interface HourlyConditionsTimelineProps {
  weather: NightWeather;
  temperatureUnit: TemperatureUnit;
  timezone?: string;
}

interface HourlyData {
  hour: number;
  label: string;
  clouds: { level: QualityLevel; value: number };
  dew: { level: QualityLevel; margin: number; temp: number; dewPoint: number };
}

function getCloudLevel(cloudCover: number): QualityLevel {
  if (cloudCover <= 25) return 'excellent';
  if (cloudCover <= 50) return 'good';
  if (cloudCover <= 75) return 'fair';
  return 'poor';
}

function getDewLevel(margin: number): QualityLevel {
  if (margin >= 6) return 'excellent';
  if (margin >= 4) return 'good';
  if (margin >= 2) return 'fair';
  return 'poor';
}

function formatHour(hour: number): string {
  if (hour === 0) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

export default function HourlyConditionsTimeline({
  weather,
  temperatureUnit,
  timezone,
}: HourlyConditionsTimelineProps) {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Processing hourly data requires multiple conditions
  const hourlyData = useMemo(() => {
    const data: HourlyData[] = [];
    const hourlyWeather = weather.hourlyData;

    // Handle both Map and object formats (in case of serialization)
    if (!hourlyWeather) return data;

    // Check if it's a Map or a plain object
    const isMap = hourlyWeather instanceof Map;
    const size = isMap ? hourlyWeather.size : Object.keys(hourlyWeather).length;
    if (size === 0) return data;

    // Get all timestamps from the hourly data (already filtered to night hours in parseNightWeather)
    // Handle both Map and plain object formats
    const timestamps = isMap
      ? Array.from(hourlyWeather.keys()).sort((a, b) => a - b)
      : Object.keys(hourlyWeather)
          .map(k => Number(k))
          .sort((a, b) => a - b);

    for (const timestamp of timestamps) {
      const hourData = isMap
        ? hourlyWeather.get(timestamp)
        : (hourlyWeather as Record<number, HourlyWeather>)[timestamp];
      if (!hourData) continue;

      const date = new Date(timestamp);
      const hour = timezone ? toZonedTime(date, timezone).getHours() : date.getHours();

      const cloudCover = hourData.cloudCover ?? 50;
      const temp = hourData.temperature ?? 10;
      const dewPoint = hourData.dewPoint ?? 5;
      const margin = temp - dewPoint;

      data.push({
        hour,
        label: formatHour(hour),
        clouds: { level: getCloudLevel(cloudCover), value: cloudCover },
        dew: { level: getDewLevel(margin), margin, temp, dewPoint },
      });
    }

    return data;
  }, [weather, timezone]);

  if (hourlyData.length === 0) {
    return null;
  }

  const displayData = hourlyData;

  return (
    <div className="mt-4">
      <h4 className="mb-3 font-medium text-gray-300 text-sm">Hourly Conditions</h4>

      {/* Grid: first column for labels, rest for hours */}
      <div
        className="grid gap-0.5 text-xs"
        style={{
          gridTemplateColumns: `auto repeat(${displayData.length}, 1fr)`,
        }}
      >
        {/* Header row - hours */}
        <div /> {/* Empty cell for label column */}
        {displayData.map(d => (
          <div key={`h-${d.hour}`} className="pb-1 text-center text-gray-500">
            {d.label}
          </div>
        ))}
        {/* Clouds row */}
        <div className="flex items-center pr-2 text-gray-400">
          <Cloud className="h-3 w-3" />
        </div>
        {displayData.map(d => (
          <div
            key={`c-${d.hour}`}
            className={`h-5 rounded-sm ${getQualityBgColor(d.clouds.level)} flex cursor-help items-center justify-center`}
            title={`${formatHour(d.hour)}: ${Math.round(d.clouds.value)}% clouds`}
          >
            {/* Mobile: abbreviated, Desktop: with % */}
            <span className="font-medium text-[9px] text-white/90 sm:hidden">
              {Math.round(d.clouds.value)}
            </span>
            <span className="hidden font-medium text-[10px] text-white/90 sm:inline">
              {Math.round(d.clouds.value)}%
            </span>
          </div>
        ))}
        {/* Dew row */}
        <div className="flex items-center pr-2 text-gray-400">
          <Droplets className="h-3 w-3" />
        </div>
        {displayData.map(d => (
          <div
            key={`d-${d.hour}`}
            className={`h-5 rounded-sm ${getQualityBgColor(d.dew.level)} flex cursor-help items-center justify-center`}
            title={`${formatHour(d.hour)}: ${formatTemperature(d.dew.temp, temperatureUnit)} / ${formatTemperature(d.dew.dewPoint, temperatureUnit)} dew (${d.dew.margin.toFixed(1)}° margin)`}
          >
            {/* Mobile: rounded margin, Desktop: with degree */}
            <span className="font-medium text-[9px] text-white/90 sm:hidden">
              {Math.round(d.dew.margin)}
            </span>
            <span className="hidden font-medium text-[10px] text-white/90 sm:inline">
              {d.dew.margin.toFixed(1)}°
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-gray-500 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
          Excellent
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-yellow-500" />
          Good
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-orange-500" />
          Fair
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-500" />
          Poor
        </span>
      </div>

      {/* Row labels explanation */}
      <div className="mt-1 flex gap-4 text-gray-600 text-xs">
        <span className="flex items-center gap-1">
          <Cloud className="h-3 w-3" /> Clouds
        </span>
        <span className="flex items-center gap-1">
          <Droplets className="h-3 w-3" /> Dew Risk
        </span>
      </div>
    </div>
  );
}
