import type { HorizonProfile, NightWeather, ScoredObject } from '@/types';
import { evaluateTargetAccessibility, type TargetAccessibility } from '../utils/horizon-profile';
import { getBestPhotoReadyWindow, type PhotoReadyWindow } from '../utils/target-photo-windows';

export interface SessionTarget {
  object: ScoredObject;
  access: TargetAccessibility;
  window: PhotoReadyWindow;
}

/** Rank deep-sky imaging opportunities using existing quality and site geometry.
 * Never recommend a blocked or elapsed interval merely because its target scores well. */
export function planSessionTargets(
  objects: ScoredObject[],
  profile: HorizonProfile,
  weather: NightWeather | null,
  now: Date
): SessionTarget[] {
  const candidates: SessionTarget[] = [];
  for (const object of objects) {
    if (object.category !== 'dso' || !object.visibility.imagingWindow) continue;
    const access = evaluateTargetAccessibility(object.visibility, profile, weather);
    const imaging = object.visibility.imagingWindow;
    const window = getBestPhotoReadyWindow(
      [
        {
          ...imaging,
          start: new Date(Math.max(imaging.start.getTime(), now.getTime())),
        },
      ],
      access
    );
    if (window) candidates.push({ object, access, window });
  }
  return candidates.sort(
    (a, b) =>
      b.object.totalScore - a.object.totalScore ||
      b.window.durationMinutes - a.window.durationMinutes
  );
}
