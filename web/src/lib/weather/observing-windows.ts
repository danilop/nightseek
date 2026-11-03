import {
  compareObservingWindows,
  MIN_OBSERVING_WINDOW_MS,
  type TimeWindow,
} from '@/lib/utils/observing-window';
import type { BestObservingTime, NightInfo, NightWeather } from '@/types';

export { collectWeatherWindows } from './observing-conditions';

import { calculateWindowNightQuality } from './night-quality';
import { collectWeatherWindows } from './observing-conditions';

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
    return { start, end, score: quality.score, reason: quality.summary };
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
  const recommended = candidates.sort(compareObservingWindows)[0] ?? null;
  const strongest = recommended
    ? (candidates
        .filter(c => c.start >= recommended.start && c.end <= recommended.end)
        .sort(
          (a, b) =>
            b.score - a.score || Number(b.end) - Number(b.start) - (Number(a.end) - Number(a.start))
        )[0] ?? null)
    : null;
  return { windows, recommended, strongest, assessedFrom: notBefore };
}
