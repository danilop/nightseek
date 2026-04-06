/**
 * Night Quality Calculator
 * Calculates an overall quality score for a night of astronomical observation
 * based on weather conditions, moon phase, and other factors.
 */

import { estimateSeeing } from '@/lib/astronomy/seeing';
import { getRatingFromPercentage, type RatingDisplay } from '@/lib/utils/rating';
import type { HourlyWeather, NightInfo, NightWeather, SeeingForecast } from '@/types';

export interface NightQualityFactors {
  clouds: number; // 0-100 contribution
  transparency: number; // 0-100 contribution
  seeing: number; // 0-100 contribution
  moon: number; // 0-100 contribution
  dewRisk: number; // 0-100 contribution
  wind: number; // 0-100 contribution
}

export interface NightQualityPenalty {
  key: keyof NightQualityFactors | 'practicality';
  detail: string;
  penalty: number;
}

export interface NightQualityMetrics {
  source: 'whole_night' | 'best_window';
  cloudCover: number | null;
  transparencyScore: number | null;
  seeingRating: SeeingForecast['rating'] | null;
  moonIllumination: number;
  dewRiskHours: number | null;
  totalHours: number;
  windSpeedKmh: number | null;
}

interface PracticalWindowPenalty {
  detail: string;
  penalty: number;
}

export interface NightQuality {
  score: number; // 0-100
  rating: RatingDisplay;
  summary: string; // "Clear skies, calm winds"
  factors: NightQualityFactors;
  penalties: NightQualityPenalty[];
  metrics: NightQualityMetrics;
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
  return Math.max(0, Math.min(100, 100 - cloudCover));
}

/**
 * Calculate transparency contribution (0-100)
 */
function calculateTransparencyScore(transparency: number | null): number {
  if (transparency === null) return 50;
  return Math.max(0, Math.min(100, transparency));
}

/**
 * Calculate seeing contribution (0-100)
 */
function calculateSeeingScore(seeingRating: SeeingForecast['rating'] | null): number {
  if (!seeingRating) return 50;

  switch (seeingRating) {
    case 'excellent':
      return 100;
    case 'good':
      return 75;
    case 'fair':
      return 50;
    case 'poor':
      return 25;
  }
}

/**
 * Calculate moon contribution (0-100)
 * Lower illumination = higher score (better for dark sky)
 */
function calculateMoonScore(illumination: number): number {
  return Math.max(0, Math.min(100, 100 - illumination));
}

/**
 * Calculate dew risk contribution (0-100)
 * Lower dew risk hours = higher score
 */
function calculateDewScore(dewRiskHours: number, totalHours: number): number {
  if (totalHours <= 0) return 100;
  const dewRiskPercent = (dewRiskHours / totalHours) * 100;
  return Math.max(0, Math.min(100, 100 - dewRiskPercent));
}

/**
 * Calculate wind contribution (0-100)
 * Lower wind = higher score (for stable imaging)
 */
function calculateWindScore(windSpeed: number | null): number {
  if (windSpeed === null) return 75;

  if (windSpeed < 10) return 100;
  if (windSpeed < 20) return 80;
  if (windSpeed < 30) return 60;
  if (windSpeed < 40) return 40;
  if (windSpeed < 50) return 20;
  return 0;
}

function averageMetric(
  hourlyData: HourlyWeather[],
  getValue: (hour: HourlyWeather) => number | null
): number | null {
  const values = hourlyData
    .map(getValue)
    .filter((value): value is number => value !== null && value !== undefined);

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getHourlySlice(weather: NightWeather, start: Date, end: Date): HourlyWeather[] {
  return Array.from(weather.hourlyData.entries())
    .filter(([time]) => time >= start.getTime() && time <= end.getTime())
    .sort((a, b) => a[0] - b[0])
    .map(([, hour]) => hour);
}

function buildWholeNightMetrics(
  weather: NightWeather | null,
  nightInfo: NightInfo
): NightQualityMetrics {
  const totalHours =
    (nightInfo.astronomicalDawn.getTime() - nightInfo.astronomicalDusk.getTime()) /
    (1000 * 60 * 60);

  return {
    source: 'whole_night',
    cloudCover: weather?.avgCloudCover ?? null,
    transparencyScore: weather?.transparencyScore ?? null,
    seeingRating: nightInfo.seeingForecast?.rating ?? null,
    moonIllumination: nightInfo.moonIllumination,
    dewRiskHours: weather?.dewRiskHours ?? null,
    totalHours,
    windSpeedKmh: weather?.avgWindSpeedKmh ?? null,
  };
}

function buildBestWindowMetrics(
  weather: NightWeather,
  nightInfo: NightInfo
): NightQualityMetrics | null {
  if (!weather.bestTime) return null;

  const hourlySlice = getHourlySlice(weather, weather.bestTime.start, weather.bestTime.end);
  if (hourlySlice.length === 0) return null;

  const avgCloudCover = averageMetric(hourlySlice, hour => hour.cloudCover);
  const avgWindSpeedKmh = averageMetric(hourlySlice, hour => hour.windSpeed);
  const avgHumidity = averageMetric(hourlySlice, hour => hour.humidity);
  const avgTempC = averageMetric(hourlySlice, hour => hour.temperature);
  const avgDewPointC = averageMetric(hourlySlice, hour => hour.dewPoint);
  const dewRiskHours = hourlySlice.filter(hour => {
    if (hour.temperature === null || hour.dewPoint === null) return false;
    return hour.temperature - hour.dewPoint < 3;
  }).length;

  return {
    source: 'best_window',
    cloudCover: avgCloudCover,
    transparencyScore: weather.transparencyScore,
    seeingRating: estimateSeeing(avgWindSpeedKmh ?? 0, avgHumidity ?? 50, avgTempC, avgDewPointC)
      .rating,
    moonIllumination: nightInfo.moonIllumination,
    dewRiskHours,
    totalHours: Math.max(
      (weather.bestTime.end.getTime() - weather.bestTime.start.getTime()) / (1000 * 60 * 60),
      1
    ),
    windSpeedKmh: avgWindSpeedKmh,
  };
}

function buildPenaltyBreakdown(
  metrics: NightQualityMetrics,
  factors: NightQualityFactors,
  practicalWindowPenalty: PracticalWindowPenalty | null = null
): NightQualityPenalty[] {
  const penalties: NightQualityPenalty[] = [
    {
      key: 'clouds',
      detail: `${Math.round(metrics.cloudCover ?? 50)}% clouds`,
      penalty: 100 - factors.clouds,
    },
    {
      key: 'transparency',
      detail: `${Math.round(metrics.transparencyScore ?? 50)}% transparency`,
      penalty: 100 - factors.transparency,
    },
    {
      key: 'seeing',
      detail: metrics.seeingRating ? `${metrics.seeingRating} seeing` : 'unknown seeing',
      penalty: 100 - factors.seeing,
    },
    {
      key: 'moon',
      detail: `${Math.round(metrics.moonIllumination)}% moon`,
      penalty: 100 - factors.moon,
    },
    {
      key: 'dewRisk',
      detail:
        metrics.dewRiskHours !== null
          ? `${Math.round(metrics.dewRiskHours)}h dew risk`
          : 'unknown dew risk',
      penalty: 100 - factors.dewRisk,
    },
    {
      key: 'wind',
      detail:
        metrics.windSpeedKmh !== null
          ? `${Math.round(metrics.windSpeedKmh)} km/h wind`
          : 'unknown wind',
      penalty: 100 - factors.wind,
    },
  ];

  if (practicalWindowPenalty) {
    penalties.push({
      key: 'practicality',
      detail: practicalWindowPenalty.detail,
      penalty: practicalWindowPenalty.penalty,
    });
  }

  return penalties.filter(penalty => penalty.penalty > 0).sort((a, b) => b.penalty - a.penalty);
}

/**
 * Generate a summary description of the night quality
 */
function generateSummary(factors: NightQualityFactors, metrics: NightQualityMetrics): string {
  if (metrics.cloudCover === null) {
    return 'No weather data — rating based on moon and astronomical conditions only';
  }

  const descriptions: string[] = [];

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

  if (factors.seeing >= 75) {
    descriptions.push('steady conditions');
  } else if (factors.seeing <= 40) {
    descriptions.push('turbulent air');
  }

  if (factors.wind >= 80) {
    descriptions.push('calm winds');
  } else if (factors.wind <= 40) {
    descriptions.push('windy');
  }

  if (factors.moon >= 90) {
    descriptions.push('dark skies');
  } else if (factors.moon <= 30) {
    descriptions.push('bright moon');
  }

  if (factors.dewRisk <= 50) {
    descriptions.push('dew risk');
  }

  return descriptions.join(', ') || 'Average conditions';
}

function buildPracticalWindowPenalty(
  metrics: NightQualityMetrics,
  weather: NightWeather | null,
  nightInfo: NightInfo
): PracticalWindowPenalty | null {
  if (metrics.source !== 'best_window' || !weather?.bestTime) return null;

  const durationHours =
    (weather.bestTime.end.getTime() - weather.bestTime.start.getTime()) / (1000 * 60 * 60);
  const hoursBeforeDawn =
    (nightInfo.astronomicalDawn.getTime() - weather.bestTime.end.getTime()) / (1000 * 60 * 60);

  let penalty = 0;
  const detailParts: string[] = [];

  if (durationHours < 2) {
    penalty += 20;
    detailParts.push('short 1h window');
  } else if (durationHours < 3) {
    penalty += 6;
    detailParts.push('short 2h window');
  }

  if (hoursBeforeDawn < 1.5) {
    penalty += 18;
    detailParts.push('near dawn');
  } else if (hoursBeforeDawn < 2.5) {
    penalty += 10;
    detailParts.push('late window');
  }

  if (metrics.cloudCover !== null) {
    if (metrics.cloudCover > 60) {
      penalty += 12;
    } else if (metrics.cloudCover > 50) {
      penalty += 6;
    }
  }

  if (penalty === 0 || detailParts.length === 0) return null;

  return {
    detail: detailParts.join(', '),
    penalty,
  };
}

function applyPracticalWindowScoreCaps(
  score: number,
  metrics: NightQualityMetrics,
  practicalWindowPenalty: PracticalWindowPenalty | null
): number {
  let cappedScore = score;

  if (metrics.source === 'best_window' && metrics.cloudCover !== null) {
    if (metrics.cloudCover > 60) {
      cappedScore = Math.min(cappedScore, 34);
    } else if (metrics.cloudCover > 50) {
      cappedScore = Math.min(cappedScore, 49);
    }
  }

  if (practicalWindowPenalty?.detail.includes('near dawn')) {
    cappedScore = Math.min(cappedScore, 49);
  }

  return cappedScore;
}

function calculateFromMetrics(
  metrics: NightQualityMetrics,
  weather: NightWeather | null = null,
  nightInfo: NightInfo | null = null
): NightQuality {
  const factors: NightQualityFactors = {
    clouds: metrics.cloudCover !== null ? calculateCloudScore(metrics.cloudCover) : 50,
    transparency: calculateTransparencyScore(metrics.transparencyScore),
    seeing: calculateSeeingScore(metrics.seeingRating),
    moon: calculateMoonScore(metrics.moonIllumination),
    dewRisk:
      metrics.dewRiskHours !== null
        ? calculateDewScore(metrics.dewRiskHours, metrics.totalHours)
        : 75,
    wind: calculateWindScore(metrics.windSpeedKmh),
  };

  let score = Math.round(
    factors.clouds * WEIGHTS.clouds +
      factors.transparency * WEIGHTS.transparency +
      factors.seeing * WEIGHTS.seeing +
      factors.moon * WEIGHTS.moon +
      factors.dewRisk * WEIGHTS.dewRisk +
      factors.wind * WEIGHTS.wind
  );

  if (metrics.cloudCover !== null) {
    if (metrics.cloudCover > 80) {
      score = Math.min(score, 34);
    } else if (metrics.cloudCover > 70) {
      score = Math.min(score, 49);
    }
  }

  const practicalWindowPenalty =
    weather && nightInfo ? buildPracticalWindowPenalty(metrics, weather, nightInfo) : null;

  if (practicalWindowPenalty) {
    score = Math.max(0, score - practicalWindowPenalty.penalty);
  }

  score = applyPracticalWindowScoreCaps(score, metrics, practicalWindowPenalty);

  return {
    score,
    rating: getRatingFromPercentage(score),
    summary: generateSummary(factors, metrics),
    factors,
    penalties: buildPenaltyBreakdown(metrics, factors, practicalWindowPenalty),
    metrics,
  };
}

/**
 * Calculate the whole-night average quality.
 */
export function calculateNightQuality(
  weather: NightWeather | null,
  nightInfo: NightInfo
): NightQuality {
  return calculateFromMetrics(buildWholeNightMetrics(weather, nightInfo), weather, nightInfo);
}

/**
 * Calculate the displayed headline quality from the best observing window,
 * falling back to whole-night averages when no best window exists.
 */
export function calculateHeadlineNightQuality(
  weather: NightWeather | null,
  nightInfo: NightInfo
): NightQuality {
  if (!weather) return calculateNightQuality(weather, nightInfo);

  const bestWindowMetrics = buildBestWindowMetrics(weather, nightInfo);
  if (!bestWindowMetrics) return calculateNightQuality(weather, nightInfo);

  return calculateFromMetrics(bestWindowMetrics, weather, nightInfo);
}
