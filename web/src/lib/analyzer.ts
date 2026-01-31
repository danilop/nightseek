import * as Astronomy from 'astronomy-engine';
import type {
  NightForecast,
  ObjectVisibility,
  Location,
  Settings,
  ScoredObject,
  NightWeather,
  DSOCatalogEntry,
} from '@/types';
import { SkyCalculator } from './astronomy/calculator';
import { PLANETS } from './astronomy/planets';
import { loadOpenNGCCatalog } from './catalogs/opengc';
import { fetchWeather, fetchAirQuality, parseNightWeather } from './weather/open-meteo';
import { detectConjunctions } from './events/conjunctions';
import { detectMeteorShowers } from './events/meteor-showers';
import { calculateTotalScore } from './scoring';

const MIN_SCORE_THRESHOLD = 60;
const MAX_WEATHER_DAYS = 16;
const MAX_AIR_QUALITY_DAYS = 5;

export interface ForecastResult {
  forecasts: NightForecast[];
  scoredObjects: Map<string, ScoredObject[]>; // keyed by date ISO string
  bestNights: string[]; // ISO date strings of best nights
}

/**
 * Generate a complete forecast for the given location and settings
 */
export async function generateForecast(
  location: Location,
  settings: Settings,
  onProgress?: (message: string, percent: number) => void
): Promise<ForecastResult> {
  const { latitude, longitude } = location;
  const { forecastDays, maxObjects, dsoMagnitude } = settings;

  const progress = (msg: string, pct: number) => onProgress?.(msg, pct);

  // Initialize calculator
  progress('Initializing astronomical calculator...', 5);
  const calculator = new SkyCalculator(latitude, longitude);
  const observer = new Astronomy.Observer(latitude, longitude, 0);

  // Load DSO catalog
  progress('Loading deep sky object catalog...', 10);
  let dsoCatalog: DSOCatalogEntry[] = [];
  try {
    dsoCatalog = await loadOpenNGCCatalog({
      maxMagnitude: dsoMagnitude,
      observerLatitude: latitude,
      minAltitude: 30,
    });
  } catch (error) {
    console.warn('Failed to load DSO catalog:', error);
  }

  // Fetch weather data (if within range)
  progress('Fetching weather data...', 20);
  let weatherData = null;
  let airQualityData = null;

  if (forecastDays <= MAX_WEATHER_DAYS) {
    try {
      weatherData = await fetchWeather(latitude, longitude, forecastDays);
    } catch (error) {
      console.warn('Failed to fetch weather:', error);
    }
  }

  if (forecastDays <= MAX_AIR_QUALITY_DAYS) {
    try {
      airQualityData = await fetchAirQuality(latitude, longitude, forecastDays);
    } catch (error) {
      console.warn('Failed to fetch air quality:', error);
    }
  }

  // Generate forecasts for each night
  const forecasts: NightForecast[] = [];
  const scoredObjects = new Map<string, ScoredObject[]>();

  const today = new Date();
  today.setHours(12, 0, 0, 0); // Start at noon

  for (let i = 0; i < forecastDays; i++) {
    const nightDate = new Date(today);
    nightDate.setDate(nightDate.getDate() + i);

    const progressPercent = 30 + Math.floor((i / forecastDays) * 60);
    progress(`Analyzing night ${i + 1} of ${forecastDays}...`, progressPercent);

    // Calculate night info
    const nightInfo = calculator.getNightInfo(nightDate);

    // Calculate planet visibility
    const planets: ObjectVisibility[] = [];
    for (const planet of PLANETS) {
      try {
        const visibility = calculator.calculatePlanetVisibility(
          planet.name,
          nightInfo
        );
        if (visibility.isVisible) {
          planets.push(visibility);
        }
      } catch (error) {
        console.warn(`Failed to calculate ${planet.name} visibility:`, error);
      }
    }

    // Calculate DSO visibility
    const dsos: ObjectVisibility[] = [];
    for (const dso of dsoCatalog.slice(0, 500)) { // Limit for performance
      const visibility = calculator.calculateVisibility(
        dso.raHours,
        dso.decDegrees,
        nightInfo,
        dso.name,
        'dso',
        {
          magnitude: dso.magnitude,
          subtype: dso.type as any,
          angularSizeArcmin: dso.majorAxisArcmin ?? 0,
          surfaceBrightness: dso.surfaceBrightness,
          commonName: dso.commonName ?? dso.name,
          isMessier: dso.messierNumber !== null,
          constellation: dso.constellation,
        }
      );

      if (visibility.isVisible) {
        dsos.push(visibility);
      }
    }

    // Calculate Milky Way visibility
    const milkyWay = calculator.calculateMilkyWayVisibility(nightInfo);

    // Calculate Moon visibility
    const moon = calculator.calculateMoonVisibility(nightInfo);

    // Parse weather for this night
    let weather: NightWeather | null = null;
    if (weatherData) {
      try {
        weather = parseNightWeather(weatherData, airQualityData, nightInfo);
      } catch (error) {
        console.warn('Failed to parse weather:', error);
      }
    }

    // Detect conjunctions
    const conjunctions = detectConjunctions(observer, planets, nightInfo);

    // Detect meteor showers
    const meteorShowers = detectMeteorShowers(calculator, nightInfo);

    // Create forecast
    const forecast: NightForecast = {
      nightInfo,
      planets,
      dsos,
      comets: [], // TODO: Add comet support
      dwarfPlanets: [],
      asteroids: [],
      milkyWay: milkyWay.isVisible ? milkyWay : null,
      moon,
      weather,
      conjunctions,
      meteorShowers,
    };

    forecasts.push(forecast);

    // Score all objects
    const sunPos = calculator.getSunPosition(nightDate);
    const allObjects: ObjectVisibility[] = [
      ...planets,
      ...dsos,
      ...(milkyWay.isVisible ? [milkyWay] : []),
    ];

    const scored = allObjects
      .map(obj => calculateTotalScore(obj, nightInfo, weather, sunPos.ra))
      .filter(s => s.totalScore >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, maxObjects);

    scoredObjects.set(nightDate.toISOString().split('T')[0], scored);
  }

  // Determine best nights
  progress('Determining best observation nights...', 95);
  const bestNights = determineBestNights(forecasts);

  progress('Complete!', 100);

  return {
    forecasts,
    scoredObjects,
    bestNights,
  };
}

/**
 * Determine the best nights based on moon and weather
 */
function determineBestNights(forecasts: NightForecast[]): string[] {
  const nightScores: Array<{ date: string; score: number }> = [];

  for (const forecast of forecasts) {
    let score = 100;

    // Moon penalty (0-50% illumination is good)
    const moonPenalty = forecast.nightInfo.moonIllumination * 0.5;
    score -= moonPenalty;

    // Weather bonus/penalty
    if (forecast.weather) {
      // Low clouds are good
      if (forecast.weather.avgCloudCover < 20) score += 20;
      else if (forecast.weather.avgCloudCover < 40) score += 10;
      else if (forecast.weather.avgCloudCover > 70) score -= 30;

      // Low precipitation is good
      if (forecast.weather.maxPrecipProbability !== null) {
        if (forecast.weather.maxPrecipProbability < 20) score += 10;
        else if (forecast.weather.maxPrecipProbability > 50) score -= 20;
      }
    }

    nightScores.push({
      date: forecast.nightInfo.date.toISOString().split('T')[0],
      score,
    });
  }

  // Sort by score and return top nights
  return nightScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(n => n.date);
}

/**
 * Get a summary of the forecast for display
 */
export function getForecastSummary(result: ForecastResult): {
  totalNights: number;
  totalObjects: number;
  bestNightDate: string | null;
  hasWeather: boolean;
  activeShowers: number;
  notableConjunctions: number;
} {
  const firstForecast = result.forecasts[0];

  let totalObjects = 0;
  for (const objects of result.scoredObjects.values()) {
    totalObjects += objects.length;
  }

  return {
    totalNights: result.forecasts.length,
    totalObjects,
    bestNightDate: result.bestNights[0] ?? null,
    hasWeather: firstForecast?.weather !== null,
    activeShowers: firstForecast?.meteorShowers.length ?? 0,
    notableConjunctions: firstForecast?.conjunctions.filter(c => c.isNotable).length ?? 0,
  };
}
