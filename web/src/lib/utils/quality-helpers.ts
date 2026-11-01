import { getRatingColorClass } from './rating';

/** The same named-quality colours as night and target ratings. */
export function getSeeingForecastColorClass(
  rating: 'excellent' | 'good' | 'fair' | 'poor'
): string {
  return getRatingColorClass(rating);
}
