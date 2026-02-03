import { Cloud, Droplets } from 'lucide-react';
import { useMemo } from 'react';
import { getQualityBgColor, type QualityLevel } from '@/lib/utils/colors';
import { formatTemperature } from '@/lib/utils/units';
import type { HourlyWeather, NightWeather, TemperatureUnit } from '@/types';

interface HourlyConditionsTimelineProps {
  weather: NightWeather;
  temperatureUnit: TemperatureUnit;
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
      const hour = date.getHours();

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
  }, [weather]);

  if (hourlyData.length === 0) {
    return null;
  }

  const displayData = hourlyData;

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium text-gray-300 mb-3">Hourly Conditions</h4>

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
          <div key={`h-${d.hour}`} className="text-center text-gray-500 pb-1">
            {d.label}
          </div>
        ))}
        {/* Clouds row */}
        <div className="flex items-center text-gray-400 pr-2">
          <Cloud className="w-3 h-3" />
        </div>
        {displayData.map(d => (
          <div
            key={`c-${d.hour}`}
            className={`h-5 rounded-sm ${getQualityBgColor(d.clouds.level)} cursor-help flex items-center justify-center`}
            title={`${formatHour(d.hour)}: ${Math.round(d.clouds.value)}% clouds`}
          >
            {/* Mobile: abbreviated, Desktop: with % */}
            <span className="text-[9px] font-medium text-white/90 sm:hidden">
              {Math.round(d.clouds.value)}
            </span>
            <span className="text-[10px] font-medium text-white/90 hidden sm:inline">
              {Math.round(d.clouds.value)}%
            </span>
          </div>
        ))}
        {/* Dew row */}
        <div className="flex items-center text-gray-400 pr-2">
          <Droplets className="w-3 h-3" />
        </div>
        {displayData.map(d => (
          <div
            key={`d-${d.hour}`}
            className={`h-5 rounded-sm ${getQualityBgColor(d.dew.level)} cursor-help flex items-center justify-center`}
            title={`${formatHour(d.hour)}: ${formatTemperature(d.dew.temp, temperatureUnit)} / ${formatTemperature(d.dew.dewPoint, temperatureUnit)} dew (${d.dew.margin.toFixed(1)}° margin)`}
          >
            {/* Mobile: rounded margin, Desktop: with degree */}
            <span className="text-[9px] font-medium text-white/90 sm:hidden">
              {Math.round(d.dew.margin)}
            </span>
            <span className="text-[10px] font-medium text-white/90 hidden sm:inline">
              {d.dew.margin.toFixed(1)}°
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-green-500 rounded-sm" />
          Excellent
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-yellow-500 rounded-sm" />
          Good
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-orange-500 rounded-sm" />
          Fair
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 bg-red-500 rounded-sm" />
          Poor
        </span>
      </div>

      {/* Row labels explanation */}
      <div className="flex gap-4 mt-1 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <Cloud className="w-3 h-3" /> Clouds
        </span>
        <span className="flex items-center gap-1">
          <Droplets className="w-3 h-3" /> Dew Risk
        </span>
      </div>
    </div>
  );
}
