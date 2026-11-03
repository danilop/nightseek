import { MIN_OBSERVING_WINDOW_MS, type TimeWindow } from '@/lib/utils/observing-window';
import type { HourlyWeather, NightInfo, NightWeather } from '@/types';
import { weatherIntervals, weatherSlices } from './hourly-slices';

/** Shared equipment/sky limits. These are planning thresholds, not a safety guarantee. */
export function observingBlockers(hour: HourlyWeather): string[] {
  const reasons: string[] = [];
  if (hour.cloudCover >= 70) reasons.push('heavy cloud');
  if ((hour.precipitation ?? 0) >= 0.1) reasons.push('rain or snow');
  if ((hour.precipProbability ?? 0) >= 70) reasons.push('high precipitation risk');
  if ((hour.windGust ?? 0) >= 40 || (hour.windSpeed ?? 0) >= 30) reasons.push('strong wind');
  if (hour.visibility !== null && hour.visibility < 1000) reasons.push('very poor visibility');
  if ((hour.fogCover ?? 0) >= 50) reasons.push('fog');
  return reasons;
}

/** Duration coverage, clipped to the same interval as the assessment. Units: hours. */
export function weatherCoverage(
  weather: NightWeather,
  night: NightInfo,
  start = night.observingWindowStart,
  end = night.observingWindowEnd
) {
  const slices = weatherSlices(weather, start, end);
  const covered = (predicate: (hour: HourlyWeather) => boolean) =>
    slices.reduce((sum, slice) => sum + (predicate(slice.hour) ? slice.hours : 0), 0);
  const valid = (value: number | null | undefined) => value != null && Number.isFinite(value);
  return {
    expected: Math.max(0, (Number(end) - Number(start)) / 3_600_000),
    weather: covered(() => true),
    aerosol: covered(h => valid(h.aod)),
    precipitation: covered(h => valid(h.precipitation) && valid(h.precipProbability)),
    wind: covered(h => valid(h.windGust) && valid(h.windSpeed)),
    visibility: covered(h => valid(h.visibility)),
    dew: covered(h => valid(h.temperature) && valid(h.dewPoint) && valid(h.humidity)),
  };
}

/** Compare duration coverage with a tolerance for floating-point hour sums. */
export function isWeatherCoverageComplete(c: ReturnType<typeof weatherCoverage>): boolean {
  return (
    c.expected > 0 &&
    Math.min(c.weather, c.aerosol, c.precipitation, c.wind, c.visibility, c.dew) >=
      c.expected - 1e-6
  );
}

export function forecastConfidence(
  weather: NightWeather | null,
  night: NightInfo,
  start = night.observingWindowStart,
  end = night.observingWindowEnd
): 'high' | 'medium' | 'low' {
  if (!weather) return 'low';
  const c = weatherCoverage(weather, night, start, end);
  if (
    c.expected <= 0 ||
    Math.min(c.weather, c.precipitation, c.wind, c.visibility) < c.expected * 0.8
  )
    return 'low';
  const leadDays = (night.date.getTime() - Date.now()) / 86_400_000;
  return isWeatherCoverageComplete(c) && leadDays <= 2 ? 'high' : 'medium';
}

/** Aerosol optical depth to the shared transparency scale. */
export function transparencyFromAod(aod: number | null): number | null {
  return aod === null ? null : Math.max(0, Math.min(100, (1 - aod / 0.5) * 100));
}

/** Only adjacent, usable forecast samples establish a period. Never bridge gaps. */
export function collectWeatherWindows(
  hours: Map<number, HourlyWeather>,
  night: NightInfo,
  cloudLimit = 70
): TimeWindow[] {
  const windows: TimeWindow[] = [];
  if (night.observingWindowMode === 'none') return windows;
  for (const { start: before, end: after, hour } of weatherIntervals(hours)) {
    if (hour.cloudCover >= cloudLimit || observingBlockers(hour).length > 0) continue;
    const start = Math.max(before, Number(night.observingWindowStart));
    const end = Math.min(after, Number(night.observingWindowEnd));
    if (end <= start) continue;
    const previous = windows[windows.length - 1];
    if (previous && Number(previous.end) === start) previous.end = new Date(end);
    else windows.push({ start: new Date(start), end: new Date(end) });
  }
  return windows.filter(w => Number(w.end) - Number(w.start) >= MIN_OBSERVING_WINDOW_MS);
}
