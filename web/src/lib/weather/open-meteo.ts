import { fromZonedTime } from 'date-fns-tz';
import { publicData, record } from '@/lib/api/public-data';
import type { HourlyWeather, NightInfo, NightWeather } from '@/types';
import { avg, maxVal, minVal, sum } from '../utils/array-math';
import { CACHE_KEYS, CACHE_TTLS, getCached, setCache } from '../utils/cache';
import { averageMetric, weatherSlices } from './hourly-slices';
import { transparencyFromAod } from './observing-conditions';
import { calculateObservingWindows, collectWeatherWindows } from './observing-windows';

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Parse an Open-Meteo local-time string into a UTC Date using the response timezone. */
function parseLocalTime(time: string | number, timezone: string): Date {
  return typeof time === 'number' ? new Date(time * 1000) : fromZonedTime(time, timezone);
}

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const HISTORICAL_API_URL = 'https://archive-api.open-meteo.com/v1/archive';

export interface WeatherAPIResponse {
  fetchedAt?: string;
  source?: string;
  timezone?: string;
  hourly: {
    time: (string | number)[];
    cloud_cover: (number | null)[];
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
    wind_direction_10m?: number[];
    wind_speed_250hPa?: number[];
    cloud_cover_2m?: number[];
  };
}

interface AirQualityAPIResponse {
  timezone?: string;
  hourly: {
    time: (string | number)[];
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
      'wind_direction_10m',
      'wind_speed_250hPa',
    ].join(','),
    // A night includes the following morning. The provider counts calendar days.
    forecast_days: Math.min(forecastDays + 1, 16).toString(),
    timezone: 'auto',
    timeformat: 'unixtime',
    past_days: '1',
  });

  const response = await fetch(`${WEATHER_API_URL}?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  try {
    const data = (await response.json()) as WeatherAPIResponse;
    // UK near-surface fog is optional; a failed regional feed must not hide the base forecast.
    if (latitude >= 49 && latitude <= 61 && longitude >= -9 && longitude <= 3) {
      const fogParams = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        hourly: 'cloud_cover_2m',
        models: 'ukmo_seamless',
        forecast_days: String(Math.min(forecastDays + 1, 8)),
        timeformat: 'unixtime',
        past_days: '1',
      });
      const fog = await publicData(
        `uk-fog:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${forecastDays}`,
        3_600_000,
        `${WEATHER_API_URL}?${fogParams}`,
        raw => {
          const h = record(record(raw).hourly);
          if (!Array.isArray(h.time) || !Array.isArray(h.cloud_cover_2m))
            throw new Error('Invalid fog forecast');
          return { time: h.time, values: h.cloud_cover_2m };
        }
      );
      if (fog) {
        const values = new Map(fog.time.map((t, i) => [t, fog.values[i]]));
        data.hourly.cloud_cover_2m = data.hourly.time.map(t => values.get(t) as number);
      }
    }
    return { ...data, fetchedAt: new Date().toISOString(), source: 'Open-Meteo best match' };
  } catch {
    throw new Error('Weather API returned invalid data. Try refreshing.');
  }
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
    forecast_days: Math.min(forecastDays + 1, 7).toString(),
    timezone: 'auto',
    timeformat: 'unixtime',
    past_days: '1',
  });

  const response = await fetch(`${AIR_QUALITY_API_URL}?${params}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Air Quality API error: ${response.status}`);
  }

  try {
    return (await response.json()) as AirQualityAPIResponse;
  } catch {
    throw new Error('Air Quality API returned invalid data. Try refreshing.');
  }
}

/**
 * Build an HourlyWeather object from hourly data at index
 */
function buildHourlyWeather(hourly: WeatherAPIResponse['hourly'], i: number): HourlyWeather {
  return {
    cloudCoverLow: hourly.cloud_cover_low?.[i] ?? null,
    cloudCoverMid: hourly.cloud_cover_mid?.[i] ?? null,
    cloudCoverHigh: hourly.cloud_cover_high?.[i] ?? null,
    windDirection: hourly.wind_direction_10m?.[i] ?? null,
    jetStreamSpeed: hourly.wind_speed_250hPa?.[i] ?? null,
    fogCover: hourly.cloud_cover_2m?.[i] ?? null,
    cloudCover: hourly.cloud_cover[i] ?? 100,
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
 * Parse weather data and combine with air quality for a specific night
 */
export function parseNightWeather(
  weatherData: WeatherAPIResponse,
  airQualityData: AirQualityAPIResponse | null,
  nightInfo: NightInfo
): NightWeather | null {
  if (
    nightInfo.observingWindowMode === 'none' ||
    nightInfo.observingWindowEnd <= nightInfo.observingWindowStart
  )
    return null;
  const { hourly } = weatherData;
  const airHourly = airQualityData?.hourly;
  const timezone = weatherData.timezone ?? BROWSER_TZ;
  const airTimezone = airQualityData?.timezone ?? timezone;
  // Parse each air-quality timestamp once, instead of rescanning the full feed
  // (including timezone conversion) for every weather hour.
  const airIndexes = new Map(
    airHourly?.time.map((time, index) => [parseLocalTime(time, airTimezone).getTime(), index])
  );

  const duskTime = nightInfo.observingWindowStart.getTime();
  const dawnTime = nightInfo.observingWindowEnd.getTime();

  const hourlyMap = new Map<number, HourlyWeather>();

  // Collect data for night hours
  for (let i = 0; i < hourly.time.length; i++) {
    const time = parseLocalTime(hourly.time[i], timezone).getTime();

    const cloudCover = hourly.cloud_cover[i];
    // null is missing data, never zero cloud. Gaps remain gaps in window searches.
    if (
      time >= Math.floor(duskTime / 3_600_000) * 3_600_000 &&
      time <= Math.ceil(dawnTime / 3_600_000) * 3_600_000 &&
      cloudCover !== null &&
      Number.isFinite(cloudCover) &&
      cloudCover >= 0 &&
      cloudCover <= 100
    ) {
      const hour = buildHourlyWeather(hourly, i);
      const airIndex = airIndexes.get(time);
      if (airHourly && airIndex !== undefined) {
        hour.aod = airHourly.aerosol_optical_depth?.[airIndex] ?? null;
        hour.pm25 = airHourly.pm2_5?.[airIndex] ?? null;
        hour.pm10 = airHourly.pm10?.[airIndex] ?? null;
        hour.dust = airHourly.dust?.[airIndex] ?? null;
      }
      hourlyMap.set(time, hour);
    }
  }

  const points = [...hourlyMap]
    .filter(([time]) => time >= duskTime && time < dawnTime)
    .map(([, hour]) => hour);
  const slices = weatherSlices(
    { hourlyData: hourlyMap },
    nightInfo.observingWindowStart,
    nightInfo.observingWindowEnd
  );
  if (!points.length && !slices.length) return null;
  // Isolated observations can describe conditions but establish no usable duration.
  const samples = slices.length ? slices : points.map(hour => ({ hour, hours: 1 }));
  const mean = (value: (hour: HourlyWeather) => number | null) => averageMetric(samples, value);
  const values = (value: (hour: HourlyWeather) => number | null) =>
    samples.map(s => value(s.hour)).filter((v): v is number => v !== null && Number.isFinite(v));
  const lowest = (value: (hour: HourlyWeather) => number | null) => {
    const v = values(value);
    return v.length ? minVal(v) : null;
  };
  const highest = (value: (hour: HourlyWeather) => number | null) => {
    const v = values(value);
    return v.length ? maxVal(v) : null;
  };
  const avgAod = mean(h => h.aod ?? null);
  const clearWindows = collectWeatherWindows(hourlyMap, nightInfo, 30).map(window => ({
    ...window,
    avgCloudCover:
      averageMetric(
        weatherSlices({ hourlyData: hourlyMap }, window.start, window.end),
        h => h.cloudCover
      ) ?? 100,
  }));

  const weather: NightWeather = {
    fetchedAt: weatherData.fetchedAt,
    source: weatherData.source,
    date: nightInfo.date,
    avgCloudCover: mean(h => h.cloudCover) ?? 100,
    minCloudCover: lowest(h => h.cloudCover) ?? 100,
    maxCloudCover: highest(h => h.cloudCover) ?? 100,
    clearDurationHours: clearWindows.reduce(
      (total, w) => total + (w.end.getTime() - w.start.getTime()) / (60 * 60 * 1000),
      0
    ),
    clearWindows,
    hourlyData: hourlyMap,
    avgVisibilityKm: mean(h => (h.visibility === null ? null : h.visibility / 1000)),
    avgWindSpeedKmh: mean(h => h.windSpeed),
    maxWindSpeedKmh: highest(h => h.windGust),
    avgHumidity: mean(h => h.humidity),
    avgTemperatureC: mean(h => h.temperature),
    transparencyScore: transparencyFromAod(avgAod),
    cloudCoverLow: mean(h => h.cloudCoverLow ?? null),
    cloudCoverMid: mean(h => h.cloudCoverMid ?? null),
    cloudCoverHigh: mean(h => h.cloudCoverHigh ?? null),
    minPrecipProbability: lowest(h => h.precipProbability),
    maxPrecipProbability: highest(h => h.precipProbability),
    totalPrecipitationMm:
      !slices.length || slices.some(s => s.hour.precipitation === null)
        ? null
        : slices.reduce((sum, s) => sum + (s.hour.precipitation ?? 0) * s.hours, 0),
    minDewMargin: lowest(h =>
      h.temperature === null || h.dewPoint === null ? null : h.temperature - h.dewPoint
    ),
    dewRiskHours:
      !slices.length || slices.some(s => s.hour.temperature === null || s.hour.dewPoint === null)
        ? null
        : slices.reduce(
            (sum, s) =>
              sum + ((s.hour.temperature ?? 0) - (s.hour.dewPoint ?? 0) < 3 ? s.hours : 0),
            0
          ),
    avgPressureHpa: mean(h => h.pressure),
    pressureTrend: calculatePressureTrend(values(h => h.pressure)),
    maxCape: highest(h => h.cape),
    bestTime: null,
    avgAerosolOpticalDepth: avgAod,
    avgPm25: mean(h => h.pm25 ?? null),
    avgPm10: mean(h => h.pm10 ?? null),
    avgDust: mean(h => h.dust ?? null),
  };
  const plan = calculateObservingWindows(weather, nightInfo);
  return {
    ...weather,
    observingWindows: plan.windows,
    bestTime: plan.recommended,
    strongestTime: plan.strongest,
    assessedFrom: plan.assessedFrom,
  };
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
  clearDays: number; // nights with cloud_cover < 30%
  totalDays: number;
  clearDayPercentage: number;
}

/** Location quality summary based on historical weather data */
export interface LocationWeatherHistory {
  latitude: number;
  longitude: number;
  monthlyStats: MonthlyWeatherStats[];
  bestMonths: MonthlyWeatherStats[];
  annualClearDays: number;
  annualClearDayPercentage: number;
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

interface MonthBucket {
  clouds: number[];
  temps: number[];
  humids: number[];
  precips: number[];
  clearDays: number;
}

function createMonthBucket(): MonthBucket {
  return { clouds: [], temps: [], humids: [], precips: [], clearDays: 0 };
}

function collectDayIntoBucket(
  bucket: MonthBucket,
  daily: HistoricalAPIResponse['daily'],
  i: number
): void {
  const cloud = daily.cloud_cover_mean?.[i];
  if (cloud != null) {
    bucket.clouds.push(cloud);
    if (cloud < 30) bucket.clearDays++;
  }

  const temp = daily.temperature_2m_mean?.[i];
  if (temp != null) bucket.temps.push(temp);

  const humid = daily.relative_humidity_2m_mean?.[i];
  if (humid != null) bucket.humids.push(humid);

  const precip = daily.precipitation_sum?.[i];
  if (precip != null) bucket.precips.push(precip);
}

function bucketToMonthStats(month: number, bucket: MonthBucket | undefined): MonthlyWeatherStats {
  if (!bucket) {
    return {
      month,
      monthName: MONTH_NAMES[month - 1],
      avgCloudCover: 50,
      avgTemperature: null,
      avgHumidity: null,
      totalPrecipitationMm: 0,
      clearDays: 0,
      totalDays: 0,
      clearDayPercentage: 0,
    };
  }

  const totalDays = bucket.clouds.length;
  return {
    month,
    monthName: MONTH_NAMES[month - 1],
    avgCloudCover: bucket.clouds.length > 0 ? avg(bucket.clouds) : 50,
    avgTemperature: bucket.temps.length > 0 ? avg(bucket.temps) : null,
    avgHumidity: bucket.humids.length > 0 ? avg(bucket.humids) : null,
    totalPrecipitationMm: bucket.precips.length > 0 ? sum(bucket.precips) : 0,
    clearDays: bucket.clearDays,
    totalDays,
    clearDayPercentage: totalDays > 0 ? (bucket.clearDays / totalDays) * 100 : 0,
  };
}

function computeMonthlyStats(
  data: HistoricalAPIResponse,
  latitude: number,
  longitude: number
): LocationWeatherHistory {
  const { daily } = data;
  const times = daily.time;

  // Group by month
  const monthBuckets = new Map<number, MonthBucket>();

  for (let i = 0; i < times.length; i++) {
    const month = new Date(times[i]).getUTCMonth() + 1; // 1-12 (date-only strings parse as UTC)
    if (!monthBuckets.has(month)) {
      monthBuckets.set(month, createMonthBucket());
    }
    const bucket = monthBuckets.get(month);
    if (!bucket) continue;
    collectDayIntoBucket(bucket, daily, i);
  }

  const monthlyStats = Array.from({ length: 12 }, (_, i) =>
    bucketToMonthStats(i + 1, monthBuckets.get(i + 1))
  );

  const totalClearDays = monthlyStats.reduce((s, m) => s + m.clearDays, 0);
  const totalDaysAll = monthlyStats.reduce((s, m) => s + m.totalDays, 0);

  // Best months = sorted by clear night percentage descending
  const bestMonths = [...monthlyStats]
    .filter(m => m.totalDays > 0)
    .sort((a, b) => b.clearDayPercentage - a.clearDayPercentage)
    .slice(0, 3);

  return {
    latitude,
    longitude,
    monthlyStats,
    bestMonths,
    annualClearDays: totalClearDays,
    annualClearDayPercentage: totalDaysAll > 0 ? (totalClearDays / totalDaysAll) * 100 : 0,
    fetchedAt: new Date().toISOString(),
  };
}
