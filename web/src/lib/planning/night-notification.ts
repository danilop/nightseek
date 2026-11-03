import type { HorizonProfile, NightForecast, ScoredObject } from '@/types';
import { calculateHeadlineNightQuality } from '../weather/night-quality';
import { planSessionTargets } from './session';

/** Native alerts use the same night assessment and eligible targets as Overview. */
export function planNightNotification(
  forecast: NightForecast,
  objects: ScoredObject[],
  profile: HorizonProfile,
  now: Date
): { title: string; body: string; at: Date } | null {
  const quality = calculateHeadlineNightQuality(forecast.weather, forecast.nightInfo);
  const at = new Date(forecast.nightInfo.sunset.getTime() - 3_600_000);
  if (!forecast.weather?.bestTime || quality.rating.stars < 4 || at <= now) return null;
  const targets = planSessionTargets(objects, profile, forecast.weather, now).slice(0, 3);
  if (!targets.length) return null;
  return {
    title: `${quality.rating.label} Observing Opportunity Tonight`,
    body: `Forecast: ${quality.summary}. Top targets: ${targets.map(target => target.object.objectName).join(', ')}. Recheck conditions before observing.`,
    at,
  };
}
