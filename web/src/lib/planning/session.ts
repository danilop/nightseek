import type { HorizonProfile, NightWeather, ScoredObject } from '@/types';
import { compareTargetScores } from '../scoring';
import { evaluateTargetAccessibility, type TargetAccessibility } from '../utils/horizon-profile';
import { getTargetPhotoWindow, type PhotoReadyWindow } from '../utils/target-photo-windows';

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
    if (object.category !== 'dso') continue;
    const access = evaluateTargetAccessibility(object.visibility, profile, weather);
    const window = getTargetPhotoWindow(object.visibility, access, now);
    if (window) candidates.push({ object, access, window });
  }
  return candidates.sort((a, b) => compareTargetScores(a.object, b.object));
}
