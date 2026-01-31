import type {
  HourlyWeather,
  ImagingWindow,
  NightInfo,
  NightWeather,
  ObjectVisibility,
} from '@/types';
import { calculateAirmass } from './airmass';

/**
 * Minimum window duration in minutes to be considered useful
 */
const MIN_WINDOW_DURATION_MINUTES = 30;

/**
 * Quality thresholds for imaging windows
 */
const QUALITY_THRESHOLDS = {
  excellent: 85,
  good: 70,
  acceptable: 50,
  poor: 0,
};

/**
 * Calculate altitude quality score (0-100)
 * Higher altitude = better quality (less atmosphere)
 */
function calculateAltitudeQuality(altitude: number): number {
  if (altitude < 20) return 0;
  if (altitude < 30) return 30;
  if (altitude < 45) return 50;
  if (altitude < 60) return 70;
  if (altitude < 75) return 85;
  return 100;
}

/**
 * Calculate airmass quality score (0-100)
 * Lower airmass = better quality
 */
function calculateAirmassQuality(altitude: number): number {
  if (altitude <= 0) return 0;

  const airmass = calculateAirmass(altitude);

  if (airmass <= 1.1) return 100; // Near zenith
  if (airmass <= 1.3) return 90; // 50-60 degrees
  if (airmass <= 1.5) return 75; // 40-50 degrees
  if (airmass <= 2.0) return 50; // 30-40 degrees
  if (airmass <= 3.0) return 25; // 20-30 degrees
  return 0;
}

/**
 * Calculate moon interference score (0-100)
 * 100 = no interference, 0 = severe interference
 */
function calculateMoonInterferenceQuality(
  moonSeparation: number | null,
  moonIllumination: number,
  moonAltitude: number
): number {
  // Moon below horizon = no interference
  if (moonAltitude <= 0) return 100;

  // Low illumination = minimal interference
  if (moonIllumination < 20) return 95;

  // No separation data
  if (moonSeparation === null) return 50;

  // Calculate combined interference
  const separationFactor = Math.min(moonSeparation / 90, 1); // 90+ degrees = full score
  const illumFactor = 1 - moonIllumination / 100;

  const quality = (separationFactor * 0.6 + illumFactor * 0.4) * 100;

  return Math.round(quality);
}

/**
 * Calculate cloud cover quality score (0-100)
 */
function calculateCloudQuality(cloudCover: number): number {
  if (cloudCover <= 10) return 100;
  if (cloudCover <= 20) return 90;
  if (cloudCover <= 30) return 75;
  if (cloudCover <= 50) return 50;
  if (cloudCover <= 70) return 25;
  return 0;
}

/**
 * Get quality rating from score
 */
function getQualityRating(score: number): ImagingWindow['quality'] {
  if (score >= QUALITY_THRESHOLDS.excellent) return 'excellent';
  if (score >= QUALITY_THRESHOLDS.good) return 'good';
  if (score >= QUALITY_THRESHOLDS.acceptable) return 'acceptable';
  return 'poor';
}

/**
 * Get weather data for a specific hour
 */
function getHourlyWeatherAt(weather: NightWeather | null, time: Date): HourlyWeather | null {
  if (!weather || !weather.hourlyData) return null;

  const hour = time.getHours();
  return weather.hourlyData.get(hour) ?? null;
}

/**
 * Calculate moon altitude at a given time
 */
function estimateMoonAltitude(time: Date, nightInfo: NightInfo): number {
  // Simple estimation based on moon rise/set
  const moonRise = nightInfo.moonRise;
  const moonSet = nightInfo.moonSet;

  if (!moonRise && !moonSet) return -10; // Moon not up during night

  const t = time.getTime();

  // If both rise and set are defined
  if (moonRise && moonSet) {
    const riseTime = moonRise.getTime();
    const setTime = moonSet.getTime();

    if (t < riseTime || t > setTime) return -10;

    // Estimate altitude as sine wave between rise and set
    const progress = (t - riseTime) / (setTime - riseTime);
    return Math.sin(progress * Math.PI) * 45; // Max ~45 degrees
  }

  // Moon is either always up or always down during the night
  // Use illumination as proxy for whether it's high
  return nightInfo.moonIllumination > 50 ? 30 : -10;
}

/**
 * Calculate imaging quality at a specific time
 */
function calculateQualityAtTime(
  time: Date,
  altitude: number,
  moonSeparation: number | null,
  nightInfo: NightInfo,
  weather: NightWeather | null
): { score: number; factors: ImagingWindow['factors'] } {
  const altitudeQuality = calculateAltitudeQuality(altitude);
  const airmassQuality = calculateAirmassQuality(altitude);
  const moonAltitude = estimateMoonAltitude(time, nightInfo);
  const moonQuality = calculateMoonInterferenceQuality(
    moonSeparation,
    nightInfo.moonIllumination,
    moonAltitude
  );

  // Get cloud cover from weather data
  const hourlyWeather = getHourlyWeatherAt(weather, time);
  const cloudCover = hourlyWeather?.cloudCover ?? weather?.avgCloudCover ?? 30;
  const cloudQuality = calculateCloudQuality(cloudCover);

  // Weighted average of all factors
  const score =
    altitudeQuality * 0.25 + airmassQuality * 0.25 + moonQuality * 0.25 + cloudQuality * 0.25;

  return {
    score: Math.round(score),
    factors: {
      altitude: altitudeQuality,
      airmass: airmassQuality,
      moonInterference: moonQuality,
      cloudCover: cloudQuality,
    },
  };
}

/**
 * Calculate imaging windows for an object throughout the night
 *
 * Analyzes the night in time slices and identifies the best periods
 * for imaging based on altitude, airmass, moon interference, and weather.
 */
export function calculateImagingWindows(
  object: ObjectVisibility,
  nightInfo: NightInfo,
  weather: NightWeather | null
): ImagingWindow[] {
  const windows: ImagingWindow[] = [];

  if (!object.isVisible || object.altitudeSamples.length === 0) {
    return windows;
  }

  // Analyze quality at each altitude sample point
  const qualityPoints: Array<{
    time: Date;
    altitude: number;
    score: number;
    factors: ImagingWindow['factors'];
  }> = [];

  for (const [time, altitude] of object.altitudeSamples) {
    if (altitude < 20) continue; // Skip very low altitudes

    const quality = calculateQualityAtTime(
      time,
      altitude,
      object.moonSeparation,
      nightInfo,
      weather
    );

    qualityPoints.push({
      time,
      altitude,
      ...quality,
    });
  }

  if (qualityPoints.length === 0) return windows;

  // Find continuous windows of acceptable quality
  let windowStart: Date | null = null;
  let windowScores: number[] = [];
  let windowFactors: ImagingWindow['factors'][] = [];

  for (let i = 0; i < qualityPoints.length; i++) {
    const point = qualityPoints[i];
    const isAcceptable = point.score >= QUALITY_THRESHOLDS.acceptable;

    if (isAcceptable && !windowStart) {
      // Start new window
      windowStart = point.time;
      windowScores = [point.score];
      windowFactors = [point.factors];
    } else if (isAcceptable && windowStart) {
      // Continue window
      windowScores.push(point.score);
      windowFactors.push(point.factors);
    } else if (!isAcceptable && windowStart) {
      // End window
      const windowEnd = qualityPoints[i - 1].time;
      const durationMinutes = (windowEnd.getTime() - windowStart.getTime()) / (60 * 1000);

      if (durationMinutes >= MIN_WINDOW_DURATION_MINUTES) {
        const avgScore = windowScores.reduce((a, b) => a + b, 0) / windowScores.length;

        // Average the factors
        const avgFactors: ImagingWindow['factors'] = {
          altitude: Math.round(
            windowFactors.reduce((a, b) => a + b.altitude, 0) / windowFactors.length
          ),
          airmass: Math.round(
            windowFactors.reduce((a, b) => a + b.airmass, 0) / windowFactors.length
          ),
          moonInterference: Math.round(
            windowFactors.reduce((a, b) => a + b.moonInterference, 0) / windowFactors.length
          ),
          cloudCover: Math.round(
            windowFactors.reduce((a, b) => a + b.cloudCover, 0) / windowFactors.length
          ),
        };

        windows.push({
          start: windowStart,
          end: windowEnd,
          quality: getQualityRating(avgScore),
          qualityScore: Math.round(avgScore),
          factors: avgFactors,
        });
      }

      windowStart = null;
      windowScores = [];
      windowFactors = [];
    }
  }

  // Handle final window if still open
  if (windowStart && windowScores.length > 0) {
    const windowEnd = qualityPoints[qualityPoints.length - 1].time;
    const durationMinutes = (windowEnd.getTime() - windowStart.getTime()) / (60 * 1000);

    if (durationMinutes >= MIN_WINDOW_DURATION_MINUTES) {
      const avgScore = windowScores.reduce((a, b) => a + b, 0) / windowScores.length;
      const avgFactors: ImagingWindow['factors'] = {
        altitude: Math.round(
          windowFactors.reduce((a, b) => a + b.altitude, 0) / windowFactors.length
        ),
        airmass: Math.round(
          windowFactors.reduce((a, b) => a + b.airmass, 0) / windowFactors.length
        ),
        moonInterference: Math.round(
          windowFactors.reduce((a, b) => a + b.moonInterference, 0) / windowFactors.length
        ),
        cloudCover: Math.round(
          windowFactors.reduce((a, b) => a + b.cloudCover, 0) / windowFactors.length
        ),
      };

      windows.push({
        start: windowStart,
        end: windowEnd,
        quality: getQualityRating(avgScore),
        qualityScore: Math.round(avgScore),
        factors: avgFactors,
      });
    }
  }

  // Sort by quality score descending
  windows.sort((a, b) => b.qualityScore - a.qualityScore);

  return windows;
}

/**
 * Get the single best imaging window for an object
 */
export function getBestImagingWindow(
  object: ObjectVisibility,
  nightInfo: NightInfo,
  weather: NightWeather | null
): ImagingWindow | null {
  const windows = calculateImagingWindows(object, nightInfo, weather);
  return windows.length > 0 ? windows[0] : null;
}

/**
 * Format imaging window for display
 */
export function formatImagingWindow(window: ImagingWindow): string {
  const startTime = window.start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const endTime = window.end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const qualityLabel = window.quality.toUpperCase();

  return `${startTime}-${endTime} [${qualityLabel}]`;
}

/**
 * Get a short summary of the best imaging window
 */
export function getImagingWindowSummary(
  object: ObjectVisibility,
  nightInfo: NightInfo,
  weather: NightWeather | null
): string | null {
  const bestWindow = getBestImagingWindow(object, nightInfo, weather);

  if (!bestWindow) {
    return null;
  }

  return `Best Window: ${formatImagingWindow(bestWindow)}`;
}
