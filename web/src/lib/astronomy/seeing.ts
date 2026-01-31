import type { NightWeather, SeeingForecast } from '@/types';

/**
 * Base seeing in arcseconds under ideal conditions
 * Average site at sea level with no wind
 */
const BASE_SEEING_ARCSEC = 2.0;

/**
 * Seeing ratings based on arcseconds
 */
const SEEING_THRESHOLDS = {
  excellent: 1.0, // < 1"
  good: 2.0, // 1-2"
  fair: 3.0, // 2-3"
  poor: 5.0, // > 3"
};

/**
 * Seeing quality descriptions
 */
const SEEING_DESCRIPTIONS: Record<SeeingForecast['rating'], string> = {
  excellent: 'Excellent for high-resolution planetary imaging',
  good: 'Good for planetary and lunar imaging',
  fair: 'Acceptable for deep-sky imaging, limited planetary',
  poor: 'Best for wide-field deep-sky only',
};

/**
 * Calculate wind contribution to seeing degradation
 * Wind causes dome and telescope shake as well as atmospheric turbulence
 */
function calculateWindFactor(windSpeedKmh: number): number {
  // Seeing degrades roughly linearly with wind above 10 km/h
  if (windSpeedKmh <= 10) {
    return 1.0;
  }

  // Each 10 km/h above threshold adds ~20% degradation
  return 1 + (windSpeedKmh - 10) / 50;
}

/**
 * Calculate altitude/airmass contribution to seeing
 * Lower altitudes = more atmosphere = worse seeing
 */
function calculateAirmassMultiplier(altitudeDeg: number): number {
  if (altitudeDeg <= 0) return 3.0;
  if (altitudeDeg >= 90) return 1.0;

  // Approximate airmass (Pickering 2002 simplified)
  const secZ = 1 / Math.sin((altitudeDeg * Math.PI) / 180);

  // Seeing scales roughly with airmass^0.6
  return secZ ** 0.6;
}

/**
 * Calculate humidity contribution to seeing
 * High humidity can cause scintillation and thermal gradients
 */
function calculateHumidityFactor(humidity: number): number {
  if (humidity < 60) return 1.0;
  if (humidity > 90) return 1.3;

  // Linear interpolation between 60-90%
  return 1 + (humidity - 60) / 100;
}

/**
 * Calculate temperature gradient effect on seeing
 * Large differences between ground and air temperature cause turbulence
 */
function calculateTemperatureGradientFactor(
  tempC: number | null,
  dewPointC: number | null
): number {
  if (tempC === null || dewPointC === null) return 1.0;

  // Temperature above dew point indicates thermal activity
  const margin = tempC - dewPointC;

  if (margin < 5) {
    // Very close to dew point - stable but high humidity
    return 1.1;
  } else if (margin > 20) {
    // Large margin can indicate thermal instability
    return 1.2;
  }

  return 1.0;
}

/**
 * Calculate confidence level based on available data
 */
function calculateConfidence(
  hasWind: boolean,
  hasHumidity: boolean,
  hasTemperature: boolean
): number {
  let confidence = 0.5; // Base confidence

  if (hasWind) confidence += 0.2;
  if (hasHumidity) confidence += 0.15;
  if (hasTemperature) confidence += 0.15;

  return Math.min(confidence, 1.0);
}

/**
 * Get seeing rating from arcseconds
 */
function getSeeingRating(arcsec: number): SeeingForecast['rating'] {
  if (arcsec <= SEEING_THRESHOLDS.excellent) return 'excellent';
  if (arcsec <= SEEING_THRESHOLDS.good) return 'good';
  if (arcsec <= SEEING_THRESHOLDS.fair) return 'fair';
  return 'poor';
}

/**
 * Estimate atmospheric seeing conditions
 *
 * This is an empirical estimation based on weather data.
 * Actual seeing depends on many factors including site-specific conditions,
 * jet stream position, and local terrain effects.
 *
 * Formula: seeing = baseSeeing * windFactor * humidityFactor * tempFactor
 *
 * @param windSpeedKmh - Wind speed in km/h
 * @param humidity - Relative humidity percentage (0-100)
 * @param tempC - Temperature in Celsius (optional)
 * @param dewPointC - Dew point in Celsius (optional)
 * @returns SeeingForecast with rating, estimate, and confidence
 */
export function estimateSeeing(
  windSpeedKmh: number = 0,
  humidity: number = 50,
  tempC: number | null = null,
  dewPointC: number | null = null
): SeeingForecast {
  const windFactor = calculateWindFactor(windSpeedKmh);
  const humidityFactor = calculateHumidityFactor(humidity);
  const tempFactor = calculateTemperatureGradientFactor(tempC, dewPointC);

  const estimatedArcsec = BASE_SEEING_ARCSEC * windFactor * humidityFactor * tempFactor;

  const rating = getSeeingRating(estimatedArcsec);
  const confidence = calculateConfidence(windSpeedKmh > 0, humidity > 0, tempC !== null);

  return {
    rating,
    estimatedArcsec: Math.round(estimatedArcsec * 10) / 10, // Round to 1 decimal
    confidence,
    recommendation: SEEING_DESCRIPTIONS[rating],
  };
}

/**
 * Estimate seeing at a specific altitude
 * Combines weather-based seeing with airmass degradation
 */
export function estimateSeeingAtAltitude(
  altitudeDeg: number,
  windSpeedKmh: number = 0,
  humidity: number = 50,
  tempC: number | null = null,
  dewPointC: number | null = null
): SeeingForecast {
  const baseSeeingForecast = estimateSeeing(windSpeedKmh, humidity, tempC, dewPointC);
  const airmassMultiplier = calculateAirmassMultiplier(altitudeDeg);

  const adjustedArcsec = baseSeeingForecast.estimatedArcsec * airmassMultiplier;
  const rating = getSeeingRating(adjustedArcsec);

  return {
    rating,
    estimatedArcsec: Math.round(adjustedArcsec * 10) / 10,
    confidence: baseSeeingForecast.confidence * 0.9, // Slightly lower confidence with altitude adjustment
    recommendation: SEEING_DESCRIPTIONS[rating],
  };
}

/**
 * Get seeing forecast from night weather data
 */
export function getSeeingFromWeather(weather: NightWeather | null): SeeingForecast {
  if (!weather) {
    return {
      rating: 'fair',
      estimatedArcsec: 2.5,
      confidence: 0.3,
      recommendation: 'No weather data available for seeing estimate',
    };
  }

  // Get average temperature and estimate dew point from humidity
  const tempC = weather.avgTemperatureC;
  const humidity = weather.avgHumidity ?? 50;

  // Estimate dew point using Magnus formula approximation
  let dewPointC: number | null = null;
  if (tempC !== null && humidity !== null) {
    const a = 17.27;
    const b = 237.7;
    const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
    dewPointC = (b * alpha) / (a - alpha);
  }

  return estimateSeeing(weather.avgWindSpeedKmh ?? 0, humidity, tempC, dewPointC);
}

/**
 * Get a summary string for seeing conditions
 */
export function getSeeingDescription(forecast: SeeingForecast): string {
  const confidenceStr = forecast.confidence >= 0.7 ? '' : ' (low confidence)';
  return `${forecast.rating.charAt(0).toUpperCase() + forecast.rating.slice(1)} seeing (${forecast.estimatedArcsec}")${confidenceStr}`;
}

/**
 * Calculate seeing score for use in object scoring (0-8 points)
 */
export function calculateSeeingScore(forecast: SeeingForecast): number {
  switch (forecast.rating) {
    case 'excellent':
      return 8;
    case 'good':
      return 6;
    case 'fair':
      return 3;
    case 'poor':
      return 0;
  }
}
