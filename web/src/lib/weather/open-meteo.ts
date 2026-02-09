import type {
  BestObservingTime,
  ClearWindow,
  HourlyWeather,
  NightInfo,
  NightWeather,
} from '@/types';
import { avg, maxVal, minVal, sum } from '../utils/array-math';
import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '../utils/cache';
import { getOrDefault } from '../utils/map-helpers';

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const HISTORICAL_API_URL = 'https://archive-api.open-meteo.com/v1/archive';

interface WeatherAPIResponse {
  hourly: {
    time: string[];
    cloud_cover: number[];
    cloud_cover_low?: number[];
    cloud_cover_mid?: number[];
    cloud_cover_high?: number[];
    visibility?: number[];
    wind_speed_10m?: number[];
    wind_gusts_10m?: number[];
    relative_humidity_2m?: number[];
    temperature_2m?: number[];
    dew_point_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    pressure_msl?: number[];
    cape?: number[];
  };
}

interface AirQualityAPIResponse {
  hourly: {
    time: string[];
    pm2_5?: number[];
    pm10?: number[];
    aerosol_optical_depth?: number[];
    dust?: number[];
  };
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  forecastDays: number
): Promise<WeatherAPIResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly: [
      'cloud_cover',
      'cloud_cover_low',
      'cloud_cover_mid',
      'cloud_cover_high',
      'visibility',
      'wind_speed_10m',
      'wind_gusts_10m',
      'relative_humidity_2m',
      'temperature_2m',
      'dew_point_2m',
      'precipitation_probability',
      'precipitation',
      'pressure_msl',
      'cape',
    ].join(','),
    forecast_days: Math.min(forecastDays, 16).toString(),
    timezone: 'auto',
  });

  const response = await fetch(`${WEATHER_API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchAirQuality(
  latitude: number,
  longitude: number,
  forecastDays: number
): Promise<AirQualityAPIResponse> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    hourly: 'pm2_5,pm10,aerosol_optical_depth,dust',
    forecast_days: Math.min(forecastDays, 5).toString(),
    timezone: 'auto',
  });

  const response = await fetch(`${AIR_QUALITY_API_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Air Quality API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Weather arrays collected during night hours
 */
interface NightWeatherArrays {
  cloudCover: number[];
  cloudCoverLow: number[];
  cloudCoverMid: number[];
  cloudCoverHigh: number[];
  visibility: number[];
  windSpeed: number[];
  windGust: number[];
  humidity: number[];
  temp: number[];
  precipProb: number[];
  precip: number[];
  pressure: number[];
  cape: number[];
  aod: number[];
  pm25: number[];
  pm10: number[];
  dust: number[];
  dewMargin: number[];
}

/**
 * Create empty weather arrays structure
 */
function createEmptyWeatherArrays(): NightWeatherArrays {
  return {
    cloudCover: [],
    cloudCoverLow: [],
    cloudCoverMid: [],
    cloudCoverHigh: [],
    visibility: [],
    windSpeed: [],
    windGust: [],
    humidity: [],
    temp: [],
    precipProb: [],
    precip: [],
    pressure: [],
    cape: [],
    aod: [],
    pm25: [],
    pm10: [],
    dust: [],
    dewMargin: [],
  };
}

/**
 * Collect hourly weather data for a single hour
 */
function collectHourlyData(
  hourly: WeatherAPIResponse['hourly'],
  i: number,
  arrays: NightWeatherArrays
): void {
  arrays.cloudCover.push(hourly.cloud_cover[i]);

  if (hourly.cloud_cover_low?.[i] != null) arrays.cloudCoverLow.push(hourly.cloud_cover_low[i]);
  if (hourly.cloud_cover_mid?.[i] != null) arrays.cloudCoverMid.push(hourly.cloud_cover_mid[i]);
  if (hourly.cloud_cover_high?.[i] != null) arrays.cloudCoverHigh.push(hourly.cloud_cover_high[i]);
  if (hourly.visibility?.[i] != null) arrays.visibility.push(hourly.visibility[i] / 1000);

  if (hourly.wind_speed_10m?.[i] != null) arrays.windSpeed.push(hourly.wind_speed_10m[i]);
  if (hourly.wind_gusts_10m?.[i] != null) arrays.windGust.push(hourly.wind_gusts_10m[i]);
  if (hourly.relative_humidity_2m?.[i] != null)
    arrays.humidity.push(hourly.relative_humidity_2m[i]);
  if (hourly.temperature_2m?.[i] != null) arrays.temp.push(hourly.temperature_2m[i]);
  if (hourly.precipitation_probability?.[i] != null)
    arrays.precipProb.push(hourly.precipitation_probability[i]);
  if (hourly.precipitation?.[i] != null) arrays.precip.push(hourly.precipitation[i]);
  if (hourly.pressure_msl?.[i] != null) arrays.pressure.push(hourly.pressure_msl[i]);
  if (hourly.cape?.[i] != null) arrays.cape.push(hourly.cape[i]);

  if (hourly.temperature_2m?.[i] != null && hourly.dew_point_2m?.[i] != null) {
    arrays.dewMargin.push(hourly.temperature_2m[i] - hourly.dew_point_2m[i]);
  }
}

/**
 * Collect air quality data for a specific time
 */
function collectAirQualityData(
  airHourly: AirQualityAPIResponse['hourly'],
  time: number,
  arrays: NightWeatherArrays
): void {
  const aqIndex = airHourly.time.findIndex(t => new Date(t).getTime() === time);
  if (aqIndex < 0) return;

  if (airHourly.aerosol_optical_depth?.[aqIndex] != null) {
    arrays.aod.push(airHourly.aerosol_optical_depth[aqIndex]);
  }
  if (airHourly.pm2_5?.[aqIndex] != null) arrays.pm25.push(airHourly.pm2_5[aqIndex]);
  if (airHourly.pm10?.[aqIndex] != null) arrays.pm10.push(airHourly.pm10[aqIndex]);
  if (airHourly.dust?.[aqIndex] != null) arrays.dust.push(airHourly.dust[aqIndex]);
}

/**
 * Build an HourlyWeather object from hourly data at index
 */
function buildHourlyWeather(hourly: WeatherAPIResponse['hourly'], i: number): HourlyWeather {
  return {
    cloudCover: hourly.cloud_cover[i],
    visibility: hourly.visibility?.[i] ?? null,
    windSpeed: hourly.wind_speed_10m?.[i] ?? null,
    windGust: hourly.wind_gusts_10m?.[i] ?? null,
    humidity: hourly.relative_humidity_2m?.[i] ?? null,
    temperature: hourly.temperature_2m?.[i] ?? null,
    dewPoint: hourly.dew_point_2m?.[i] ?? null,
    precipProbability: hourly.precipitation_probability?.[i] ?? null,
    precipitation: hourly.precipitation?.[i] ?? null,
    pressure: hourly.pressure_msl?.[i] ?? null,
    cape: hourly.cape?.[i] ?? null,
    aod: null,
    pm25: null,
    pm10: null,
    dust: null,
  };
}

/**
 * Calculate transparency score from AOD
 */
function calculateTransparencyScore(avgAod: number | null): number | null {
  if (avgAod === null) return null;
  return Math.max(0, Math.min(100, (1 - avgAod / 0.5) * 100));
}

/**
 * Calculate pressure trend from pressure array
 */
function calculatePressureTrend(pressureValues: number[]): 'rising' | 'falling' | 'steady' | null {
  if (pressureValues.length < 2) return null;

  const diff = pressureValues[pressureValues.length - 1] - pressureValues[0];
  if (diff > 2) return 'rising';
  if (diff < -2) return 'falling';
  return 'steady';
}

/**
 * Get optional average - returns null if array is empty
 */
function avgOrNull(arr: number[]): number | null {
  return arr.length > 0 ? avg(arr) : null;
}

/**
 * Get optional min - returns null if array is empty
 */
function minOrNull(arr: number[]): number | null {
  return arr.length > 0 ? minVal(arr) : null;
}

/**
 * Get optional max - returns null if array is empty
 */
function maxOrNull(arr: number[]): number | null {
  return arr.length > 0 ? maxVal(arr) : null;
}

/**
 * Parse weather data and combine with air quality for a specific night
 */
export function parseNightWeather(
  weatherData: WeatherAPIResponse,
  airQualityData: AirQualityAPIResponse | null,
  nightInfo: NightInfo
): NightWeather | null {
  const { hourly } = weatherData;
  const airHourly = airQualityData?.hourly;

  const duskTime = nightInfo.astronomicalDusk.getTime();
  const dawnTime = nightInfo.astronomicalDawn.getTime();

  const hourlyMap = new Map<number, HourlyWeather>();
  const arrays = createEmptyWeatherArrays();

  // Collect data for night hours
  for (let i = 0; i < hourly.time.length; i++) {
    const time = new Date(hourly.time[i]).getTime();

    if (time >= duskTime && time <= dawnTime) {
      collectHourlyData(hourly, i, arrays);
      if (airHourly) collectAirQualityData(airHourly, time, arrays);
      hourlyMap.set(time, buildHourlyWeather(hourly, i));
    }
  }

  // No hourly data matched the night window — this night is beyond the API range
  if (arrays.cloudCover.length === 0) return null;

  const avgAod = avgOrNull(arrays.aod);
  const clearWindows = findClearWindows(hourlyMap, duskTime, dawnTime);
  const bestTime = findBestObservingTime(hourlyMap, duskTime, dawnTime);

  return {
    date: nightInfo.date,
    avgCloudCover: avg(arrays.cloudCover),
    minCloudCover: minVal(arrays.cloudCover),
    maxCloudCover: maxVal(arrays.cloudCover),
    clearDurationHours: clearWindows.reduce(
      (total, w) => total + (w.end.getTime() - w.start.getTime()) / (60 * 60 * 1000),
      0
    ),
    clearWindows,
    hourlyData: hourlyMap,
    avgVisibilityKm: avgOrNull(arrays.visibility),
    avgWindSpeedKmh: avgOrNull(arrays.windSpeed),
    maxWindSpeedKmh: maxOrNull(arrays.windGust),
    avgHumidity: avgOrNull(arrays.humidity),
    avgTemperatureC: avgOrNull(arrays.temp),
    transparencyScore: calculateTransparencyScore(avgAod),
    cloudCoverLow: avgOrNull(arrays.cloudCoverLow),
    cloudCoverMid: avgOrNull(arrays.cloudCoverMid),
    cloudCoverHigh: avgOrNull(arrays.cloudCoverHigh),
    minPrecipProbability: minOrNull(arrays.precipProb),
    maxPrecipProbability: maxOrNull(arrays.precipProb),
    totalPrecipitationMm: arrays.precip.length > 0 ? sum(arrays.precip) : null,
    minDewMargin: minOrNull(arrays.dewMargin),
    dewRiskHours: arrays.dewMargin.filter(m => m < 3).length,
    avgPressureHpa: avgOrNull(arrays.pressure),
    pressureTrend: calculatePressureTrend(arrays.pressure),
    maxCape: maxOrNull(arrays.cape),
    bestTime,
    avgAerosolOpticalDepth: avgAod,
    avgPm25: avgOrNull(arrays.pm25),
    avgPm10: avgOrNull(arrays.pm10),
    avgDust: avgOrNull(arrays.dust),
  };
}

/**
 * Finalize a clear window if it meets minimum duration
 */
function finalizeClearWindow(
  windowStart: Date,
  windowEnd: Date,
  cloudCoverValues: number[]
): ClearWindow | null {
  if (cloudCoverValues.length < 2) return null;
  return {
    start: windowStart,
    end: windowEnd,
    avgCloudCover: avg(cloudCoverValues),
  };
}

function findClearWindows(
  hourlyData: Map<number, HourlyWeather>,
  _duskTime: number,
  dawnTime: number
): ClearWindow[] {
  const windows: ClearWindow[] = [];
  let windowStart: Date | null = null;
  let windowCloudCover: number[] = [];

  const times = Array.from(hourlyData.keys()).sort((a, b) => a - b);

  for (const time of times) {
    const data = getOrDefault(hourlyData, time, { cloudCover: 100 } as HourlyWeather);

    if (data.cloudCover < 30) {
      if (!windowStart) {
        windowStart = new Date(time);
        windowCloudCover = [];
      }
      windowCloudCover.push(data.cloudCover);
    } else if (windowStart) {
      const window = finalizeClearWindow(
        windowStart,
        new Date(time - 60 * 60 * 1000),
        windowCloudCover
      );
      if (window) windows.push(window);
      windowStart = null;
      windowCloudCover = [];
    }
  }

  // Handle window that extends to dawn
  if (windowStart) {
    const window = finalizeClearWindow(windowStart, new Date(dawnTime), windowCloudCover);
    if (window) windows.push(window);
  }

  return windows;
}

/**
 * Score a single hour for observing quality
 */
function scoreObservingHour(data: HourlyWeather): number {
  let score = 100 - data.cloudCover;

  if (data.humidity !== null && data.humidity < 70) {
    score += 10;
  }

  if (data.windGust !== null && data.windGust > 30) {
    score -= 20;
  }

  return score;
}

/**
 * Get reason string for observing conditions
 */
function getObservingReason(cloudCover: number): string {
  if (cloudCover < 20) return 'Clear skies';
  if (cloudCover < 40) return 'Partly cloudy';
  return 'Best conditions';
}

function findBestObservingTime(
  hourlyData: Map<number, HourlyWeather>,
  _duskTime: number,
  _dawnTime: number
): BestObservingTime | null {
  let bestScore = -1;
  let bestStart: Date | null = null;
  let bestEnd: Date | null = null;
  let bestReason = '';

  const times = Array.from(hourlyData.keys()).sort((a, b) => a - b);

  for (let i = 0; i < times.length - 1; i++) {
    const windowHours: number[] = [];

    for (let j = i; j < Math.min(i + 3, times.length); j++) {
      const data = getOrDefault(hourlyData, times[j], { cloudCover: 100 } as HourlyWeather);
      windowHours.push(scoreObservingHour(data));
    }

    if (windowHours.length > 0) {
      const avgScore = avg(windowHours);
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestStart = new Date(times[i]);
        bestEnd = new Date(times[Math.min(i + 2, times.length - 1)]);

        const data = getOrDefault(hourlyData, times[i], { cloudCover: 100 } as HourlyWeather);
        bestReason = getObservingReason(data.cloudCover);
      }
    }
  }

  if (bestStart && bestEnd && bestScore > 20) {
    return {
      start: bestStart,
      end: bestEnd,
      score: bestScore,
      reason: bestReason || 'Least cloudy period',
    };
  }

  return null;
}

// ─── Historical Weather ──────────────────────────────────────────────────────

interface HistoricalAPIResponse {
  daily: {
    time: string[];
    cloud_cover_mean?: number[];
    temperature_2m_mean?: number[];
    relative_humidity_2m_mean?: number[];
    precipitation_sum?: number[];
  };
}

/** Monthly summary statistics for a location */
export interface MonthlyWeatherStats {
  month: number; // 1-12
  monthName: string;
  avgCloudCover: number;
  avgTemperature: number | null;
  avgHumidity: number | null;
  totalPrecipitationMm: number;
  clearNights: number; // nights with cloud_cover < 30%
  totalNights: number;
  clearNightPercentage: number;
}

/** Location quality summary based on historical weather data */
export interface LocationWeatherHistory {
  latitude: number;
  longitude: number;
  monthlyStats: MonthlyWeatherStats[];
  bestMonths: MonthlyWeatherStats[];
  annualClearNights: number;
  annualClearNightPercentage: number;
  fetchedAt: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Fetch historical weather data for a location (past 12 months).
 * Uses the Open-Meteo Archive API (CORS-enabled, no API key).
 * Cached aggressively (30 days) since historical data doesn't change.
 */
export async function fetchHistoricalWeather(
  latitude: number,
  longitude: number
): Promise<LocationWeatherHistory | null> {
  const cacheKey = `${CACHE_KEYS.HISTORICAL_WEATHER_PREFIX}${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  const cached = await getCached<LocationWeatherHistory>(cacheKey, CACHE_TTLS.HISTORICAL_WEATHER);
  if (cached) return cached;

  // Query past 12 months
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // yesterday (archive may lag by 1 day)
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - 1);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    daily: 'cloud_cover_mean,temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum',
    timezone: 'auto',
  });

  try {
    const response = await fetch(`${HISTORICAL_API_URL}?${params}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as HistoricalAPIResponse;
    if (!data.daily?.time) return null;

    const result = computeMonthlyStats(data, latitude, longitude);
    await setCache(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}

function computeMonthlyStats(
  data: HistoricalAPIResponse,
  latitude: number,
  longitude: number
): LocationWeatherHistory {
  const { daily } = data;
  const times = daily.time;

  // Group by month
  const monthBuckets: Map<
    number,
    { clouds: number[]; temps: number[]; humids: number[]; precips: number[]; clearNights: number }
  > = new Map();

  for (let i = 0; i < times.length; i++) {
    const month = new Date(times[i]).getMonth() + 1; // 1-12
    if (!monthBuckets.has(month)) {
      monthBuckets.set(month, { clouds: [], temps: [], humids: [], precips: [], clearNights: 0 });
    }
    const bucket = monthBuckets.get(month)!;

    const cloud = daily.cloud_cover_mean?.[i];
    if (cloud != null) {
      bucket.clouds.push(cloud);
      // A "clear night" is a day with mean cloud cover < 30%
      if (cloud < 30) bucket.clearNights++;
    }

    const temp = daily.temperature_2m_mean?.[i];
    if (temp != null) bucket.temps.push(temp);

    const humid = daily.relative_humidity_2m_mean?.[i];
    if (humid != null) bucket.humids.push(humid);

    const precip = daily.precipitation_sum?.[i];
    if (precip != null) bucket.precips.push(precip);
  }

  const monthlyStats: MonthlyWeatherStats[] = [];
  let totalClearNights = 0;
  let totalNightsAll = 0;

  for (let m = 1; m <= 12; m++) {
    const bucket = monthBuckets.get(m);
    if (!bucket) {
      monthlyStats.push({
        month: m,
        monthName: MONTH_NAMES[m - 1],
        avgCloudCover: 50,
        avgTemperature: null,
        avgHumidity: null,
        totalPrecipitationMm: 0,
        clearNights: 0,
        totalNights: 0,
        clearNightPercentage: 0,
      });
      continue;
    }

    const totalNights = bucket.clouds.length;
    totalClearNights += bucket.clearNights;
    totalNightsAll += totalNights;

    monthlyStats.push({
      month: m,
      monthName: MONTH_NAMES[m - 1],
      avgCloudCover: bucket.clouds.length > 0 ? avg(bucket.clouds) : 50,
      avgTemperature: bucket.temps.length > 0 ? avg(bucket.temps) : null,
      avgHumidity: bucket.humids.length > 0 ? avg(bucket.humids) : null,
      totalPrecipitationMm: bucket.precips.length > 0 ? sum(bucket.precips) : 0,
      clearNights: bucket.clearNights,
      totalNights,
      clearNightPercentage: totalNights > 0 ? (bucket.clearNights / totalNights) * 100 : 0,
    });
  }

  // Best months = sorted by clear night percentage descending
  const bestMonths = [...monthlyStats]
    .filter(m => m.totalNights > 0)
    .sort((a, b) => b.clearNightPercentage - a.clearNightPercentage)
    .slice(0, 3);

  return {
    latitude,
    longitude,
    monthlyStats,
    bestMonths,
    annualClearNights: totalClearNights,
    annualClearNightPercentage: totalNightsAll > 0 ? (totalClearNights / totalNightsAll) * 100 : 0,
    fetchedAt: new Date().toISOString(),
  };
}
