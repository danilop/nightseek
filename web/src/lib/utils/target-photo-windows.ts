import type { ImagingWindow } from '@/types';
import type { TargetAccessibility } from './horizon-profile';

export interface PhotoReadyWindow extends ImagingWindow {
  durationMinutes: number;
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

      intersections.push({
        ...imagingWindow,
        start: new Date(startMs),
        end: new Date(endMs),
        durationMinutes: (endMs - startMs) / 60_000,
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
