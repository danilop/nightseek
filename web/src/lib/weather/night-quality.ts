/**
 * Night Quality Calculator
 * Calculates an overall quality score for a night of astronomical observation
 * based on weather conditions, actual observing-window moonlight, and other factors.
 */

import { calculateMoonlightInfo } from '@/lib/astronomy/moonlight';
import { estimateSeeing } from '@/lib/astronomy/seeing';
import { formatDurationMinutes } from '@/lib/utils/format';
import { MIN_OBSERVING_WINDOW_MS } from '@/lib/utils/observing-window';
import { getRatingFromPercentage, type RatingDisplay } from '@/lib/utils/rating';
import type { NightInfo, NightWeather, SeeingForecast } from '@/types';
import { averageMetric, weatherSlices } from './hourly-slices';
import {
  collectWeatherWindows,
  forecastConfidence,
  isWeatherCoverageComplete,
  observingBlockers,
  transparencyFromAod,
  weatherCoverage,
} from './observing-conditions';

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
  moonlightExposure: number;
  dewRiskHours: number | null;
  totalHours: number;
  windSpeedKmh: number | null;
}

export interface NightQuality {
  score: number; // 0-100
  conditionsScore: number; // Window conditions before opportunity duration adjustment
  confidence: 'high' | 'medium' | 'low';
  opportunity?: {
    usableHours: number;
    longestHours: number;
    windowCount: number;
    label: string;
  };
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
 * Lower moonlight exposure = higher score (better for dark sky)
 */
function calculateMoonScore(exposure: number): number {
  return Math.max(0, Math.min(100, 100 - exposure));
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

function buildWholeNightMetrics(
  weather: NightWeather | null,
  nightInfo: NightInfo
): NightQualityMetrics {
  const totalHours =
    (nightInfo.observingWindowEnd.getTime() - nightInfo.observingWindowStart.getTime()) /
    (1000 * 60 * 60);

  return {
    source: 'whole_night',
    cloudCover: weather?.avgCloudCover ?? null,
    transparencyScore: weather?.transparencyScore ?? null,
    seeingRating: nightInfo.seeingForecast?.rating ?? null,
    moonlightExposure: nightInfo.moonlight.exposurePercent,
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

  const hourlySlice = weatherSlices(weather, weather.bestTime.start, weather.bestTime.end);
  if (hourlySlice.length === 0) return null;

  const avgCloudCover = averageMetric(hourlySlice, hour => hour.cloudCover);
  const avgWindSpeedKmh = averageMetric(hourlySlice, hour => hour.windSpeed);
  const avgHumidity = averageMetric(hourlySlice, hour => hour.humidity);
  const avgTempC = averageMetric(hourlySlice, hour => hour.temperature);
  const avgDewPointC = averageMetric(hourlySlice, hour => hour.dewPoint);
  const dewRiskHours = hourlySlice
    .filter(({ hour }) => {
      if (hour.temperature === null || hour.dewPoint === null) return false;
      return hour.temperature - hour.dewPoint < 3;
    })
    .reduce((sum, slice) => sum + slice.hours, 0);

  return {
    source: 'best_window',
    cloudCover: avgCloudCover,
    transparencyScore: transparencyFromAod(averageMetric(hourlySlice, hour => hour.aod ?? null)),
    seeingRating:
      avgWindSpeedKmh === null || avgHumidity === null
        ? null
        : estimateSeeing(avgWindSpeedKmh, avgHumidity, avgTempC, avgDewPointC).rating,
    moonlightExposure: nightInfo.moonAltitudeSamples
      ? calculateMoonlightInfo(
          nightInfo.moonIllumination,
          nightInfo.moonAltitudeSamples,
          weather.bestTime.start,
          weather.bestTime.end
        ).exposurePercent
      : nightInfo.moonlight.exposurePercent,
    dewRiskHours: hourlySlice.some(
      ({ hour }) => hour.temperature === null || hour.dewPoint === null
    )
      ? null
      : dewRiskHours,
    totalHours: Math.max(
      (weather.bestTime.end.getTime() - weather.bestTime.start.getTime()) / (1000 * 60 * 60),
      0.5
    ),
    windSpeedKmh: avgWindSpeedKmh,
  };
}

function buildPenaltyBreakdown(
  metrics: NightQualityMetrics,
  factors: NightQualityFactors
): NightQualityPenalty[] {
  const penalties: NightQualityPenalty[] = [
    {
      key: 'clouds',
      detail: `${Math.round(metrics.cloudCover ?? 50)}% clouds`,
      penalty: 100 - factors.clouds,
    },
    {
      key: 'transparency',
      detail:
        metrics.transparencyScore === null
          ? 'unknown transparency'
          : `${Math.round(metrics.transparencyScore)}% transparency`,
      penalty: 100 - factors.transparency,
    },
    {
      key: 'seeing',
      detail: metrics.seeingRating ? `${metrics.seeingRating} seeing` : 'unknown seeing',
      penalty: 100 - factors.seeing,
    },
    {
      key: 'moon',
      detail: `${Math.round(metrics.moonlightExposure)}% moonlight exposure`,
      penalty: 100 - factors.moon,
    },
    {
      key: 'dewRisk',
      detail:
        metrics.dewRiskHours === null
          ? 'unknown dew risk'
          : `${formatDurationMinutes(metrics.dewRiskHours * 60)} dew risk`,
      penalty: 100 - factors.dewRisk,
    },
    {
      key: 'wind',
      detail:
        metrics.windSpeedKmh === null
          ? 'unknown wind'
          : `${Math.round(metrics.windSpeedKmh)} km/h wind`,
      penalty: 100 - factors.wind,
    },
  ];

  return penalties
    .map(p => ({
      ...p,
      penalty: Math.round(p.penalty * WEIGHTS[p.key as keyof NightQualityFactors] * 100) / 100,
    }))
    .filter(p => p.penalty > 0)
    .sort((a, b) => b.penalty - a.penalty);
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
    descriptions.push('little moonlight');
  } else if (factors.moon <= 30) {
    descriptions.push('bright moon');
  }

  if (factors.dewRisk <= 50) {
    descriptions.push('dew risk');
  }

  return descriptions.join(', ') || 'Average conditions';
}

interface ObservingWindowLimit {
  penalty: number;
  cap: number;
  penaltyLabel: string;
  summaryLabel: string;
}

const OBSERVING_WINDOW_LIMITS: Partial<
  Record<NightInfo['observingWindowMode'], ObservingWindowLimit>
> = {
  nautical: {
    penalty: 15,
    cap: 69,
    penaltyLabel: 'astronomical twilight only',
    summaryLabel: 'Astronomical twilight only',
  },
  civil: {
    penalty: 35,
    cap: 49,
    penaltyLabel: 'nautical twilight only',
    summaryLabel: 'Nautical twilight only',
  },
  sunset: {
    penalty: 55,
    cap: 34,
    penaltyLabel: 'civil twilight only',
    summaryLabel: 'Civil twilight only',
  },
};

function applyObservingWindowLimit(
  score: number,
  penalties: NightQualityPenalty[],
  conditionsSummary: string,
  nightInfo: NightInfo | null
): { score: number; summary: string } {
  const mode = nightInfo?.observingWindowMode ?? 'astronomical';
  if (mode === 'none') {
    penalties.unshift({
      key: 'practicality',
      detail: 'Sun does not set or enter a usable twilight window',
      penalty: 100,
    });
    return { score: 0, summary: 'No usable night or twilight observing window' };
  }

  const limit = OBSERVING_WINDOW_LIMITS[mode];
  if (!limit) return { score, summary: conditionsSummary };

  const minimumSunAltitude = nightInfo?.minimumSunAltitude ?? 0;
  penalties.unshift({
    key: 'practicality',
    detail: `${limit.penaltyLabel} (Sun ${minimumSunAltitude.toFixed(1)}° at darkest)`,
    penalty: limit.penalty,
  });
  return {
    score: Math.min(Math.max(0, score - limit.penalty), limit.cap),
    summary: `${limit.summaryLabel} — ${conditionsSummary}`,
  };
}

function calculateFromMetrics(
  metrics: NightQualityMetrics,
  weather: NightWeather | null = null,
  nightInfo: NightInfo | null = null
): NightQuality {
  const factors: NightQualityFactors = {
    clouds: metrics.cloudCover === null ? 50 : calculateCloudScore(metrics.cloudCover),
    transparency: calculateTransparencyScore(metrics.transparencyScore),
    seeing: calculateSeeingScore(metrics.seeingRating),
    moon: calculateMoonScore(metrics.moonlightExposure),
    dewRisk:
      metrics.dewRiskHours === null
        ? 50
        : calculateDewScore(metrics.dewRiskHours, metrics.totalHours),
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

  // Continuous limits: cloud and moonlight cannot be cancelled by calm winds.
  // This is a dark-sky imaging heuristic, not a calibrated success probability.
  const penalties = buildPenaltyBreakdown(metrics, factors);
  const cloudCap = metrics.cloudCover === null ? 69 : Math.max(0, 100 - 1.2 * metrics.cloudCover);
  const moonCap = 100 - 0.4 * metrics.moonlightExposure;
  const limited = Math.round(Math.min(score, cloudCap, moonCap));
  if (limited < score)
    penalties.push({
      key: 'practicality',
      detail: cloudCap < moonCap ? 'Cloud limits imaging' : 'Moonlight limits dark-sky imaging',
      penalty: score - limited,
    });
  score = limited;
  let conditionsSummary = generateSummary(factors, metrics);
  const start =
    metrics.source === 'best_window' ? weather?.bestTime?.start : nightInfo?.observingWindowStart;
  const end =
    metrics.source === 'best_window' ? weather?.bestTime?.end : nightInfo?.observingWindowEnd;
  const selected = weather && start && end ? weatherSlices(weather, start, end) : [];
  const blockedHours = selected.reduce(
    (sum, s) => sum + (observingBlockers(s.hour).length ? s.hours : 0),
    0
  );
  const selectedHours = selected.reduce((sum, s) => sum + s.hours, 0);
  if (blockedHours > 0 && selectedHours > 0) {
    const loss = Math.round((score * blockedHours) / selectedHours);
    score -= loss;
    penalties.push({
      key: 'practicality',
      detail: 'Unsuitable weather within interval',
      penalty: loss,
    });
  }
  const confidence = nightInfo ? forecastConfidence(weather, nightInfo, start, end) : 'low';
  if (!weather) score = Math.min(score, 49);
  if (weather && nightInfo) {
    const coverage = weatherCoverage(weather, nightInfo, start, end);
    if (!isWeatherCoverageComplete(coverage)) {
      const capped = Math.min(score, 69);
      if (capped < score)
        penalties.push({
          key: 'practicality',
          detail: 'Incomplete weather evidence',
          penalty: score - capped,
        });
      score = capped;
      conditionsSummary += ' · incomplete weather evidence';
    }
  }
  const windowLimited = applyObservingWindowLimit(score, penalties, conditionsSummary, nightInfo);

  return {
    conditionsScore: windowLimited.score,
    confidence,
    score: windowLimited.score,
    rating: getRatingFromPercentage(windowLimited.score),
    summary: windowLimited.summary,
    factors,
    penalties,
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

/** One night-opportunity assessment for calendar, cards, rankings and notifications. */
export function calculateHeadlineNightQuality(
  weather: NightWeather | null,
  nightInfo: NightInfo
): NightQuality {
  const fallback = calculateNightQuality(weather, nightInfo);
  const cutoff = weather?.assessedFrom ?? nightInfo.observingWindowStart;
  const windows = weather
    ? collectWeatherWindows(weather.hourlyData, nightInfo)
        .map(w => ({ start: new Date(Math.max(Number(w.start), Number(cutoff))), end: w.end }))
        .filter(w => Number(w.end) - Number(w.start) >= MIN_OBSERVING_WINDOW_MS)
    : [];
  const durations = windows.map(w => (Number(w.end) - Number(w.start)) / 3_600_000);
  const usableHours = durations.reduce((sum, h) => sum + h, 0);
  const longestHours = Math.max(0, ...durations);
  // Other blocks earn half credit for setup/reacquisition. Four equivalent hours
  // remove the duration reduction; no night-length fraction penalises summer twice.
  const label =
    usableHours === 0
      ? weather
        ? 'No remaining opportunity'
        : 'Opportunity unknown'
      : longestHours < 1
        ? 'Brief opportunity'
        : windows.length > 1
          ? 'Split opportunity'
          : 'Continuous opportunity';
  const opportunity = {
    usableHours,
    longestHours,
    windowCount: windows.length,
    label,
  };
  if (!weather || !usableHours)
    return {
      ...fallback,
      score: 0,
      rating: getRatingFromPercentage(0),
      summary: label,
      opportunity,
    };
  const conditions = windows.map(w =>
    calculateWindowNightQuality(weather, nightInfo, w.start, w.end)
  );
  // Integrate local quality before summing: adding a worse but usable hour must
  // never lower opportunity. Whole-block average squared would violate this.
  let peakScore = 0;
  const qualityHours = windows.map(w => {
    let total = 0;
    for (let time = Number(w.start); time < Number(w.end); time += MIN_OBSERVING_WINDOW_MS) {
      const end = Math.min(Number(w.end), time + MIN_OBSERVING_WINDOW_MS);
      const q = calculateWindowNightQuality(weather, nightInfo, new Date(time), new Date(end));
      peakScore = Math.max(peakScore, q.score);
      total += ((end - time) / 3_600_000) * (q.score / 100) ** 2;
    }
    return total;
  });
  const effectiveQualityHours =
    (qualityHours.reduce((sum, h) => sum + h, 0) + Math.max(...qualityHours)) / 2;
  const score = Math.round(Math.min(peakScore, 100 * Math.sqrt(effectiveQualityHours / 4)));
  const session = weather.bestTime
    ? calculateWindowNightQuality(weather, nightInfo, weather.bestTime.start, weather.bestTime.end)
    : conditions[durations.indexOf(longestHours)];
  const confidence = conditions.some(q => q.confidence === 'low')
    ? 'low'
    : conditions.some(q => q.confidence === 'medium')
      ? 'medium'
      : 'high';
  const penalties = [...session.penalties];
  if (score < peakScore)
    penalties.unshift({
      key: 'practicality',
      detail: `${formatDurationMinutes(usableHours * 60)} usable · ${formatDurationMinutes(longestHours * 60)} longest block`,
      penalty: Math.round(peakScore - score),
    });
  return {
    ...session,
    conditionsScore: session.score,
    score,
    rating: getRatingFromPercentage(score),
    confidence,
    opportunity,
    penalties,
    summary: `${label} · ${session.summary}`,
  };
}

/** Conditions only: duration belongs to session selection and night opportunity. */
export function calculateWindowNightQuality(
  weather: NightWeather,
  night: NightInfo,
  start: Date,
  end: Date
): NightQuality {
  const scoped = { ...weather, bestTime: { start, end, score: 0, reason: '' } };
  return calculateFromMetrics(
    buildBestWindowMetrics(scoped, night) ?? buildWholeNightMetrics(scoped, night),
    scoped,
    night
  );
}
