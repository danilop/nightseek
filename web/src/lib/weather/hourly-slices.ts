import type { HourlyWeather, NightWeather } from '@/types';

/** A sample describes conditions up to the next known hour, never across a gap. */
export function weatherIntervals(hours: Map<number, HourlyWeather>) {
  const entries = [...hours.entries()].sort(([a], [b]) => a - b);
  return entries.slice(0, -1).flatMap(([start, hour], i) => {
    const end = entries[i + 1][0];
    return end - start <= 3_600_000 ? [{ start, end, hour }] : [];
  });
}

/** Duration-weighted weather evidence for exactly the requested interval. */
export function weatherSlices(weather: NightWeather, start: Date, end: Date) {
  return weatherIntervals(weather.hourlyData).flatMap(interval => {
    const duration = Math.min(interval.end, Number(end)) - Math.max(interval.start, Number(start));
    return duration > 0 ? [{ hour: interval.hour, hours: duration / 3_600_000 }] : [];
  });
}

/** One weather-time lookup for night timelines and target calculations. */
export function hourlyWeatherAt(weather: NightWeather | null, time: Date): HourlyWeather | null {
  if (!weather) return null;
  const exact = weather.hourlyData.get(Number(time));
  if (exact) return exact;
  return weatherSlices(weather, time, new Date(Number(time) + 1))[0]?.hour ?? null;
}
