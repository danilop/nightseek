/**
 * Night Quality Calculator
 * Calculates an overall quality score for a night of astronomical observation
 * based on weather conditions, moon phase, and other factors.
 */

import { getRatingFromPercentage, type RatingDisplay } from '@/lib/utils/rating';
import type { NightInfo, NightWeather } from '@/types';

export interface NightQualityFactors {
  clouds: number; // 0-100 contribution
  transparency: number; // 0-100 contribution
  seeing: number; // 0-100 contribution
  moon: number; // 0-100 contribution
  dewRisk: number; // 0-100 contribution
  wind: number; // 0-100 contribution
}

export interface NightQuality {
  score: number; // 0-100
  rating: RatingDisplay;
  summary: string; // "Clear skies, calm winds"
  factors: NightQualityFactors;
}

/**
 * Scoring weights (must sum to 1.0)
 */
const WEIGHTS = {
  clouds: 0.35,
  transparency: 0.2,
  seeing: 0.15,
  moon: 0.15,
  dewRisk: 0.1,
  wind: 0.05,
} as const;

/**
 * Calculate cloud cover contribution (0-100)
 * Lower cloud cover = higher score
 */
function calculateCloudScore(cloudCover: number): number {
  // Invert: 0% clouds = 100 score, 100% clouds = 0 score
  return Math.max(0, Math.min(100, 100 - cloudCover));
}

/**
 * Calculate transparency contribution (0-100)
 */
function calculateTransparencyScore(transparency: number | null): number {
  if (transparency === null) return 50; // Default middle value
  return Math.max(0, Math.min(100, transparency));
}

/**
 * Calculate seeing contribution (0-100)
 */
function calculateSeeingScore(seeingRating: string | null): number {
  if (!seeingRating) return 50; // Default middle value

  switch (seeingRating) {
    case 'excellent':
      return 100;
    case 'good':
      return 75;
    case 'fair':
      return 50;
    case 'poor':
      return 25;
    default:
      return 50;
  }
}

/**
 * Calculate moon contribution (0-100)
 * Lower illumination = higher score (better for dark sky)
 */
function calculateMoonScore(illumination: number): number {
  // Invert: 0% illumination = 100 score, 100% = 0 score
  return Math.max(0, Math.min(100, 100 - illumination));
}

/**
 * Calculate dew risk contribution (0-100)
 * Lower dew risk hours = higher score
 */
function calculateDewScore(dewRiskHours: number, totalHours: number): number {
  if (totalHours <= 0) return 100;
  // Calculate percentage of night without dew risk
  const dewRiskPercent = (dewRiskHours / totalHours) * 100;
  return Math.max(0, Math.min(100, 100 - dewRiskPercent));
}

/**
 * Calculate wind contribution (0-100)
 * Lower wind = higher score (for stable imaging)
 */
function calculateWindScore(windSpeed: number | null): number {
  if (windSpeed === null) return 75; // Default moderately good

  // Wind scoring thresholds (km/h)
  if (windSpeed < 10) return 100;
  if (windSpeed < 20) return 80;
  if (windSpeed < 30) return 60;
  if (windSpeed < 40) return 40;
  if (windSpeed < 50) return 20;
  return 0;
}

/**
 * Generate a summary description of the night quality
 */
function generateSummary(factors: NightQualityFactors, weather: NightWeather | null): string {
  if (!weather) {
    return 'No weather data — rating based on moon and astronomical conditions only';
  }

  const descriptions: string[] = [];

  // Cloud description
  if (factors.clouds >= 90) {
    descriptions.push('Clear skies');
  } else if (factors.clouds >= 70) {
    descriptions.push('Mostly clear');
  } else if (factors.clouds >= 50) {
    descriptions.push('Partly cloudy');
  } else if (factors.clouds >= 30) {
    descriptions.push('Mostly cloudy');
  } else {
    descriptions.push('Overcast');
  }

  // Seeing description
  if (factors.seeing >= 75) {
    descriptions.push('steady conditions');
  } else if (factors.seeing <= 40) {
    descriptions.push('turbulent air');
  }

  // Wind description
  if (factors.wind >= 80) {
    descriptions.push('calm winds');
  } else if (factors.wind <= 40) {
    descriptions.push('windy');
  }

  // Moon description
  if (factors.moon >= 90) {
    descriptions.push('dark skies');
  } else if (factors.moon <= 30) {
    descriptions.push('bright moon');
  }

  // Dew warning
  if (factors.dewRisk <= 50) {
    descriptions.push('dew risk');
  }

  return descriptions.join(', ') || 'Average conditions';
}

/**
 * Calculate the overall night quality
 */
export function calculateNightQuality(
  weather: NightWeather | null,
  nightInfo: NightInfo
): NightQuality {
  // Calculate observation window duration
  const duskTime = nightInfo.astronomicalDusk.getTime();
  const dawnTime = nightInfo.astronomicalDawn.getTime();
  const totalHours = (dawnTime - duskTime) / (1000 * 60 * 60);

  // Calculate individual factor scores
  const factors: NightQualityFactors = {
    clouds: weather ? calculateCloudScore(weather.avgCloudCover) : 50,
    transparency: weather ? calculateTransparencyScore(weather.transparencyScore) : 50,
    seeing: calculateSeeingScore(nightInfo.seeingForecast?.rating ?? null),
    moon: calculateMoonScore(nightInfo.moonIllumination),
    dewRisk: weather ? calculateDewScore(weather.dewRiskHours, totalHours) : 75,
    wind: weather ? calculateWindScore(weather.avgWindSpeedKmh) : 75,
  };

  // Calculate weighted total score
  let score = Math.round(
    factors.clouds * WEIGHTS.clouds +
      factors.transparency * WEIGHTS.transparency +
      factors.seeing * WEIGHTS.seeing +
      factors.moon * WEIGHTS.moon +
      factors.dewRisk * WEIGHTS.dewRisk +
      factors.wind * WEIGHTS.wind
  );

  // Cloud cover gate: heavy overcast caps the maximum rating regardless
  // of other factors, since observation is physically impossible through clouds
  if (weather) {
    if (weather.avgCloudCover > 80) {
      score = Math.min(score, 34); // Max "Fair" (2 stars)
    } else if (weather.avgCloudCover > 70) {
      score = Math.min(score, 49); // Max "Good" (3 stars)
    }
  }

  // Get rating display
  const rating = getRatingFromPercentage(score);

  // Generate summary
  const summary = generateSummary(factors, weather);

  return {
    score,
    rating,
    summary,
    factors,
  };
}
