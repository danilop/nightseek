import {
  compareObservingWindows,
  MIN_OBSERVING_WINDOW_MS,
  type TimeWindow,
} from '@/lib/utils/observing-window';
import type { BestObservingTime, HourlyWeather, NightInfo, NightWeather } from '@/types';
import { weatherIntervals } from './hourly-slices';
import { calculateWindowNightQuality } from './night-quality';
import { observingBlockers } from './observing-conditions';

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

function candidateBoundaries(window: TimeWindow, notBefore: Date): number[] {
  const start = Math.max(Number(window.start), Number(notBefore));
  const end = Number(window.end);
  if (end - start < MIN_OBSERVING_WINDOW_MS) return [];
  const boundaries = [start];
  for (
    let time = Number(window.start) + MIN_OBSERVING_WINDOW_MS;
    time < end;
    time += MIN_OBSERVING_WINDOW_MS
  ) {
    if (time > start) boundaries.push(time);
  }
  boundaries.push(end);
  return boundaries;
}

/** All usable periods plus the strongest remaining interval, without a dawn buffer or duration cap. */
export function calculateObservingWindows(
  weather: NightWeather,
  night: NightInfo,
  notBefore = night.observingWindowStart
) {
  const evaluate = (start: Date, end: Date): BestObservingTime => {
    const quality = calculateWindowNightQuality(weather, night, start, end);
    return { start, end, score: quality.conditionsScore, reason: quality.summary };
  };
  const windows = collectWeatherWindows(weather.hourlyData, night).map(w =>
    evaluate(w.start, w.end)
  );
  const candidates: BestObservingTime[] = [];
  for (const window of windows) {
    const boundaries = candidateBoundaries(window, notBefore);
    for (let i = 0; i < boundaries.length - 1; i++) {
      for (let j = i + 1; j < boundaries.length; j++) {
        if (boundaries[j] - boundaries[i] >= MIN_OBSERVING_WINDOW_MS)
          candidates.push(evaluate(new Date(boundaries[i]), new Date(boundaries[j])));
      }
    }
  }
  return { windows, recommended: candidates.sort(compareObservingWindows)[0] ?? null };
}
