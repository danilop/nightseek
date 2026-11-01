import { hourlyWeatherAt } from '@/lib/weather/hourly-slices';
import { observingBlockers } from '@/lib/weather/observing-conditions';
import type { HourlyWeather, NightInfo, NightWeather } from '@/types';
import { getAltitudeAtTime } from './altitude-interpolation';

/** Shared time geometry uses elapsed time, including nights with a clock change. */
export function timelinePosition(time: Date | number, start: Date, end: Date): number {
  const span = end.getTime() - start.getTime();
  return span > 0 ? Math.max(0, Math.min(100, ((Number(time) - start.getTime()) / span) * 100)) : 0;
}

export function timelineWeatherAt(
  time: number,
  weather: NightWeather | null
): HourlyWeather | null {
  return hourlyWeatherAt(weather, new Date(time));
}

export function buildNightTimeline(night: NightInfo, weather: NightWeather | null) {
  const start = night.sunset.getTime();
  const end = night.sunrise.getTime();
  const samples = night.moonAltitudeSamples ?? [];
  const segments = [];
  for (let time = start; time < end; time += 900_000) {
    const until = Math.min(time + 900_000, end);
    const middle = (time + until) / 2;
    const hour = timelineWeatherAt(middle, weather);
    const blockers = hour ? observingBlockers(hour) : [];
    const moonKnown =
      samples.length > 1 &&
      middle >= Number(samples[0][0]) &&
      middle <= Number(samples[samples.length - 1][0]);
    segments.push({
      time,
      until,
      left: timelinePosition(time, night.sunset, night.sunrise),
      width:
        timelinePosition(until, night.sunset, night.sunrise) -
        timelinePosition(time, night.sunset, night.sunrise),
      weather: hour ? (blockers.length ? 'blocked' : 'available') : 'unknown',
      moon: moonKnown
        ? getAltitudeAtTime(samples, new Date(middle)) > 0
          ? 'up'
          : 'down'
        : 'unknown',
    });
  }
  return segments;
}
