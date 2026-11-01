import type { ImagingWindow, ObjectVisibility } from '@/types';
import { getImagingQualityRating } from '../astronomy/imaging-windows';
import type { TargetAccessibility } from './horizon-profile';
import { compareObservingWindows, MIN_OBSERVING_WINDOW_MS } from './observing-window';

export interface PhotoReadyWindow extends ImagingWindow {
  durationMinutes: number;
}

const MIN_PHOTO_READY_DURATION_MINUTES = MIN_OBSERVING_WINDOW_MS / 60_000;

/** Integrate retained samples over the actual fragment, including interpolated edges. */
function clipWindow(window: ImagingWindow, start: Date, end: Date): PhotoReadyWindow {
  const result = { ...window, start, end, durationMinutes: (Number(end) - Number(start)) / 60_000 };
  if (!window.samples || window.samples.length < 2) return result;
  const totals = { altitude: 0, airmass: 0, moonInterference: 0, cloudCover: 0 };
  let duration = 0;
  let score = 0;
  for (let i = 1; i < window.samples.length; i++) {
    const a = window.samples[i - 1];
    const b = window.samples[i];
    const from = Math.max(Number(start), Number(a.time));
    const to = Math.min(Number(end), Number(b.time));
    if (to <= from) continue;
    const span = Number(b.time) - Number(a.time);
    const midpoint = ((from + to) / 2 - Number(a.time)) / span;
    const weight = to - from;
    score += (a.score + (b.score - a.score) * midpoint) * weight;
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[key] += (a.factors[key] + (b.factors[key] - a.factors[key]) * midpoint) * weight;
    }
    duration += weight;
  }
  if (!duration) return result;
  const qualityScore = Math.round(score / duration);
  for (const key of Object.keys(totals) as (keyof typeof totals)[])
    totals[key] = Math.round(totals[key] / duration);
  return {
    ...result,
    qualityScore,
    quality: getImagingQualityRating(qualityScore),
    factors: totals,
  };
}

function comparePhotoWindows(a: PhotoReadyWindow, b: PhotoReadyWindow) {
  return compareObservingWindows({ ...a, score: a.qualityScore }, { ...b, score: b.qualityScore });
}

/**
 * Restrict atmosphere/Moon/weather imaging windows to the exact intervals that
 * clear the user's whole-sky minimum and directional horizon obstructions.
 */
export function intersectImagingAndAccessWindows(
  imagingWindows: readonly ImagingWindow[],
  accessibility: TargetAccessibility
): PhotoReadyWindow[] {
  const intersections: PhotoReadyWindow[] = [];

  for (const imagingWindow of imagingWindows) {
    for (const accessWindow of accessibility.windows) {
      const startMs = Math.max(imagingWindow.start.getTime(), accessWindow.start.getTime());
      const endMs = Math.min(imagingWindow.end.getTime(), accessWindow.end.getTime());
      if (endMs <= startMs) continue;

      const durationMinutes = (endMs - startMs) / 60_000;
      if (durationMinutes < MIN_PHOTO_READY_DURATION_MINUTES) continue;

      intersections.push(clipWindow(imagingWindow, new Date(startMs), new Date(endMs)));
    }
  }

  return intersections.sort(comparePhotoWindows);
}

export function getBestPhotoReadyWindow(
  imagingWindows: readonly ImagingWindow[],
  accessibility: TargetAccessibility
): PhotoReadyWindow | null {
  return intersectImagingAndAccessWindows(imagingWindows, accessibility)[0] ?? null;
}

/** One photo-window policy for cards, filters, search and session planning. */
export function getTargetPhotoWindows(
  visibility: ObjectVisibility,
  accessibility?: TargetAccessibility,
  now: Date = new Date()
): PhotoReadyWindow[] {
  const windows = (
    visibility.imagingWindows ?? (visibility.imagingWindow ? [visibility.imagingWindow] : [])
  ).map(window =>
    clipWindow(window, new Date(Math.max(Number(window.start), Number(now))), window.end)
  );
  if (accessibility) return intersectImagingAndAccessWindows(windows, accessibility);
  return windows
    .filter(window => window.durationMinutes >= MIN_PHOTO_READY_DURATION_MINUTES)
    .sort(comparePhotoWindows);
}

export function getTargetPhotoWindow(
  visibility: ObjectVisibility,
  accessibility?: TargetAccessibility,
  now: Date = new Date()
): PhotoReadyWindow | null {
  return getTargetPhotoWindows(visibility, accessibility, now)[0] ?? null;
}
