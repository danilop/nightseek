import type { NightWeather, HourlyWeather, BestObservingTime, ClearWindow, NightInfo } from '@/types';

const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const AIR_QUALITY_API_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

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
 * Parse weather data and combine with air quality for a specific night
 */
export function parseNightWeather(
  weatherData: WeatherAPIResponse,
  airQualityData: AirQualityAPIResponse | null,
  nightInfo: NightInfo
): NightWeather {
  const { hourly } = weatherData;
  const airHourly = airQualityData?.hourly;

  const duskTime = nightInfo.astronomicalDusk.getTime();
  const dawnTime = nightInfo.astronomicalDawn.getTime();

  const hourlyMap = new Map<number, HourlyWeather>();
  const nightCloudCover: number[] = [];
  const nightWindSpeed: number[] = [];
  const nightWindGust: number[] = [];
  const nightHumidity: number[] = [];
  const nightTemp: number[] = [];
  const nightPrecipProb: number[] = [];
  const nightPrecip: number[] = [];
  const nightPressure: number[] = [];
  const nightCape: number[] = [];
  const nightAod: number[] = [];
  const nightPm25: number[] = [];
  const nightPm10: number[] = [];
  const nightDust: number[] = [];
  const nightDewMargin: number[] = [];

  for (let i = 0; i < hourly.time.length; i++) {
    const time = new Date(hourly.time[i]).getTime();

    // Only include hours within the night
    if (time >= duskTime && time <= dawnTime) {
      const cloudCover = hourly.cloud_cover[i];
      nightCloudCover.push(cloudCover);

      if (hourly.wind_speed_10m?.[i] != null) nightWindSpeed.push(hourly.wind_speed_10m[i]);
      if (hourly.wind_gusts_10m?.[i] != null) nightWindGust.push(hourly.wind_gusts_10m[i]);
      if (hourly.relative_humidity_2m?.[i] != null) nightHumidity.push(hourly.relative_humidity_2m[i]);
      if (hourly.temperature_2m?.[i] != null) nightTemp.push(hourly.temperature_2m[i]);
      if (hourly.precipitation_probability?.[i] != null) nightPrecipProb.push(hourly.precipitation_probability[i]);
      if (hourly.precipitation?.[i] != null) nightPrecip.push(hourly.precipitation[i]);
      if (hourly.pressure_msl?.[i] != null) nightPressure.push(hourly.pressure_msl[i]);
      if (hourly.cape?.[i] != null) nightCape.push(hourly.cape[i]);

      // Calculate dew margin
      if (hourly.temperature_2m?.[i] != null && hourly.dew_point_2m?.[i] != null) {
        nightDewMargin.push(hourly.temperature_2m[i] - hourly.dew_point_2m[i]);
      }

      // Find matching air quality data
      if (airHourly) {
        const aqIndex = airHourly.time.findIndex(t => new Date(t).getTime() === time);
        if (aqIndex >= 0) {
          if (airHourly.aerosol_optical_depth?.[aqIndex] != null) {
            nightAod.push(airHourly.aerosol_optical_depth[aqIndex]);
          }
          if (airHourly.pm2_5?.[aqIndex] != null) nightPm25.push(airHourly.pm2_5[aqIndex]);
          if (airHourly.pm10?.[aqIndex] != null) nightPm10.push(airHourly.pm10[aqIndex]);
          if (airHourly.dust?.[aqIndex] != null) nightDust.push(airHourly.dust[aqIndex]);
        }
      }

      hourlyMap.set(time, {
        cloudCover,
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
      });
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const minVal = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : 0;
  const maxVal = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;

  // Calculate transparency score from AOD
  const avgAod = nightAod.length > 0 ? avg(nightAod) : null;
  const transparencyScore = avgAod !== null ? Math.max(0, Math.min(100, (1 - avgAod / 0.5) * 100)) : null;

  // Calculate pressure trend
  let pressureTrend: 'rising' | 'falling' | 'steady' | null = null;
  if (nightPressure.length >= 2) {
    const diff = nightPressure[nightPressure.length - 1] - nightPressure[0];
    if (diff > 2) pressureTrend = 'rising';
    else if (diff < -2) pressureTrend = 'falling';
    else pressureTrend = 'steady';
  }

  // Find clear windows (< 30% cloud cover for at least 2 hours)
  const clearWindows = findClearWindows(hourlyMap, duskTime, dawnTime);

  // Calculate best observing time
  const bestTime = findBestObservingTime(hourlyMap, duskTime, dawnTime);

  // Count dew risk hours
  const dewRiskHours = nightDewMargin.filter(m => m < 3).length;

  return {
    date: nightInfo.date,
    avgCloudCover: avg(nightCloudCover),
    minCloudCover: minVal(nightCloudCover),
    maxCloudCover: maxVal(nightCloudCover),
    clearDurationHours: clearWindows.reduce((sum, w) =>
      sum + (w.end.getTime() - w.start.getTime()) / (60 * 60 * 1000), 0
    ),
    clearWindows,
    hourlyData: hourlyMap,
    avgVisibilityKm: nightWindSpeed.length > 0 ? avg(nightWindSpeed) : null,
    avgWindSpeedKmh: nightWindSpeed.length > 0 ? avg(nightWindSpeed) : null,
    maxWindSpeedKmh: nightWindGust.length > 0 ? maxVal(nightWindGust) : null,
    avgHumidity: nightHumidity.length > 0 ? avg(nightHumidity) : null,
    avgTemperatureC: nightTemp.length > 0 ? avg(nightTemp) : null,
    transparencyScore,
    cloudCoverLow: hourly.cloud_cover_low ? avg(hourly.cloud_cover_low) : null,
    cloudCoverMid: hourly.cloud_cover_mid ? avg(hourly.cloud_cover_mid) : null,
    cloudCoverHigh: hourly.cloud_cover_high ? avg(hourly.cloud_cover_high) : null,
    minPrecipProbability: nightPrecipProb.length > 0 ? minVal(nightPrecipProb) : null,
    maxPrecipProbability: nightPrecipProb.length > 0 ? maxVal(nightPrecipProb) : null,
    totalPrecipitationMm: nightPrecip.length > 0 ? nightPrecip.reduce((a, b) => a + b, 0) : null,
    minDewMargin: nightDewMargin.length > 0 ? minVal(nightDewMargin) : null,
    dewRiskHours,
    avgPressureHpa: nightPressure.length > 0 ? avg(nightPressure) : null,
    pressureTrend,
    maxCape: nightCape.length > 0 ? maxVal(nightCape) : null,
    bestTime,
    avgAerosolOpticalDepth: avgAod,
    avgPm25: nightPm25.length > 0 ? avg(nightPm25) : null,
    avgPm10: nightPm10.length > 0 ? avg(nightPm10) : null,
    avgDust: nightDust.length > 0 ? avg(nightDust) : null,
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
    const data = hourlyData.get(time)!;

    if (data.cloudCover < 30) {
      if (!windowStart) {
        windowStart = new Date(time);
        windowCloudCover = [];
      }
      windowCloudCover.push(data.cloudCover);
    } else {
      if (windowStart && windowCloudCover.length >= 2) {
        windows.push({
          start: windowStart,
          end: new Date(time - 60 * 60 * 1000),
          avgCloudCover: windowCloudCover.reduce((a, b) => a + b, 0) / windowCloudCover.length,
        });
      }
      windowStart = null;
      windowCloudCover = [];
    }
  }

  // Handle window that extends to dawn
  if (windowStart && windowCloudCover.length >= 2) {
    windows.push({
      start: windowStart,
      end: new Date(dawnTime),
      avgCloudCover: windowCloudCover.reduce((a, b) => a + b, 0) / windowCloudCover.length,
    });
  }

  return windows;
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

  // Find the best 2-hour window
  for (let i = 0; i < times.length - 1; i++) {
    let windowScore = 0;
    let windowHours = 0;
    const reasons: string[] = [];

    for (let j = i; j < Math.min(i + 3, times.length); j++) {
      const data = hourlyData.get(times[j])!;

      // Score based on cloud cover (0-100, inverted)
      let hourScore = 100 - data.cloudCover;

      // Bonus for low humidity
      if (data.humidity !== null && data.humidity < 70) {
        hourScore += 10;
      }

      // Penalty for high wind
      if (data.windGust !== null && data.windGust > 30) {
        hourScore -= 20;
      }

      windowScore += hourScore;
      windowHours++;
    }

    if (windowHours > 0) {
      const avgScore = windowScore / windowHours;
      if (avgScore > bestScore) {
        bestScore = avgScore;
        bestStart = new Date(times[i]);
        bestEnd = new Date(times[Math.min(i + 2, times.length - 1)]);

        const data = hourlyData.get(times[i])!;
        if (data.cloudCover < 20) {
          reasons.push('Clear skies');
        } else if (data.cloudCover < 40) {
          reasons.push('Partly cloudy');
        }
        bestReason = reasons.join(', ') || 'Best conditions';
      }
    }
  }

  if (bestStart && bestEnd && bestScore > 50) {
    return {
      start: bestStart,
      end: bestEnd,
      score: bestScore,
      reason: bestReason,
    };
  }

  return null;
}
