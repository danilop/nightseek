import { formatDateKey } from '@/lib/utils/format';
import type { NightForecast } from '@/types';
import { calculateHeadlineNightQuality } from './night-quality';

/**
 * Determine the best nights based on night quality score.
 * Uses the same scoring system as the displayed night rating for consistency.
 * Only considers nights that have a valid observation window (bestTime).
 */
export function determineBestNights(forecasts: NightForecast[], timezone?: string): string[] {
  const nightScores: Array<{ date: string; score: number }> = [];

  for (const forecast of forecasts) {
    // Only consider nights with a valid observation window
    // This ensures "best nights" always have a usable observation period
    if (!forecast.weather?.bestTime) {
      continue;
    }

    // Use the same night quality calculation as displayed in the UI
    // This ensures the "best nights" badge aligns with the star rating shown
    const quality = calculateHeadlineNightQuality(forecast.weather, forecast.nightInfo);

    nightScores.push({
      date: formatDateKey(forecast.nightInfo.date, timezone),
      score: quality.score,
    });
  }

  // Sort by score and return top nights (up to 3)
  // Only include nights with at least a "fair" score (40+)
  return nightScores
    .filter(n => n.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(n => n.date);
}
