import type { ImagingWindow, ObjectVisibility } from '@/types';
import type { TargetAccessibility } from './horizon-profile';

export interface PhotoReadyWindow extends ImagingWindow {
  durationMinutes: number;
}

const MIN_PHOTO_READY_DURATION_MINUTES = 30;

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

      intersections.push({
        ...imagingWindow,
        start: new Date(startMs),
        end: new Date(endMs),
        durationMinutes,
      });
    }
  }

  return intersections.sort(
    (a, b) => b.qualityScore - a.qualityScore || b.durationMinutes - a.durationMinutes
  );
}

export function getBestPhotoReadyWindow(
  imagingWindows: readonly ImagingWindow[],
  accessibility: TargetAccessibility
): PhotoReadyWindow | null {
  return intersectImagingAndAccessWindows(imagingWindows, accessibility)[0] ?? null;
}

/** One photo-window policy for cards, filters, search and session planning. */
export function getTargetPhotoWindow(
  visibility: ObjectVisibility,
  accessibility?: TargetAccessibility,
  now: Date = new Date()
): PhotoReadyWindow | null {
  const windows = (
    visibility.imagingWindows ?? (visibility.imagingWindow ? [visibility.imagingWindow] : [])
  ).map(window => ({
    ...window,
    start: new Date(Math.max(window.start.getTime(), now.getTime())),
  }));
  if (accessibility) return getBestPhotoReadyWindow(windows, accessibility);
  return (
    windows
      .map(window => ({
        ...window,
        durationMinutes: (window.end.getTime() - window.start.getTime()) / 60_000,
      }))
      .filter(window => window.durationMinutes >= MIN_PHOTO_READY_DURATION_MINUTES)
      .sort(
        (a, b) => b.qualityScore - a.qualityScore || b.durationMinutes - a.durationMinutes
      )[0] ?? null
  );
}
