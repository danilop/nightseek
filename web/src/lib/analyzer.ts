import * as Astronomy from 'astronomy-engine';
import type {
  AstronomicalEvents,
  DSOCatalogEntry,
  Location,
  NightForecast,
  NightWeather,
  ObjectVisibility,
  ScoredObject,
  Settings,
} from '@/types';
import { SkyCalculator } from './astronomy/calculator';
import { getConstellation, getPlanetConstellation } from './astronomy/constellations';
import {
  detectMaxElongations,
  getElongationForPlanet,
  isInnerPlanet,
  isOuterPlanet,
} from './astronomy/elongation';
import { getJupiterMoonsData } from './astronomy/galilean-moons';
import { getBestImagingWindow } from './astronomy/imaging-windows';
import { getLibrationForNight } from './astronomy/libration';
import { getLunarApsisForNight } from './astronomy/lunar-apsis';
import { getEclipseSeasonInfo } from './astronomy/lunar-nodes';
import { getMoonPhaseEvents } from './astronomy/moon-phases';
import { detectOppositions, getOppositionForPlanet } from './astronomy/opposition';
import { getPlanetsNearPerihelion, isNearPerihelion } from './astronomy/planet-apsis';
import { PLANETS } from './astronomy/planets';
import { getSeeingFromWeather } from './astronomy/seeing';
import { getLocalSiderealTime } from './astronomy/sidereal';
import { getVenusPeakInfo } from './astronomy/venus-peak';
import { calculateCometVisibility, fetchComets } from './catalogs/comets';
import { getCommonName } from './catalogs/common-names';
import {
  calculateMinorPlanetVisibility,
  getDwarfPlanets,
  getNotableAsteroids,
} from './catalogs/minor-planets';
import { loadOpenNGCCatalog } from './catalogs/opengc';
import { detectConjunctions } from './events/conjunctions';
import { detectEclipses } from './events/eclipses';
import { detectMeteorShowers } from './events/meteor-showers';
import { detectSeasonalMarkers } from './events/seasons';
import { getTransitForDisplay } from './events/transits';
import { calculateTotalScore } from './scoring';
import { fetchAirQuality, fetchWeather, parseNightWeather } from './weather/open-meteo';

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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Forecast generation orchestrates many calculations
export async function generateForecast(
  location: Location,
  settings: Settings,
  onProgress?: (message: string, percent: number) => void
): Promise<ForecastResult> {
  const { latitude, longitude } = location;
  const { forecastDays, dsoMagnitude } = settings;

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
  } catch {
    // DSO catalog loading failed - continue without DSO data
  }

  // Fetch comets from MPC
  progress('Loading comet data...', 15);
  const cometCatalog = await fetchComets(settings.cometMagnitude);

  // Load minor planets (dwarf planets and asteroids)
  const dwarfPlanets = getDwarfPlanets();
  const asteroids = getNotableAsteroids();

  // Fetch weather data (if within range)
  progress('Fetching weather data...', 20);
  let weatherData = null;
  let airQualityData = null;

  if (forecastDays <= MAX_WEATHER_DAYS) {
    try {
      weatherData = await fetchWeather(latitude, longitude, forecastDays);
    } catch {
      // Weather fetch failed - continue without weather data
    }
  }

  if (forecastDays <= MAX_AIR_QUALITY_DAYS) {
    try {
      airQualityData = await fetchAirQuality(latitude, longitude, forecastDays);
    } catch {
      // Air quality fetch failed - continue without air quality data
    }
  }

  // Generate forecasts for each night
  const forecasts: NightForecast[] = [];
  const scoredObjects = new Map<string, ScoredObject[]>();

  const today = new Date();
  today.setHours(12, 0, 0, 0); // Start at noon

  // Pre-calculate planetary events for the forecast window (cache these)
  progress('Calculating planetary events...', 25);
  const oppositions = detectOppositions(today, forecastDays);
  const maxElongations = detectMaxElongations(today, forecastDays);

  for (let i = 0; i < forecastDays; i++) {
    const nightDate = new Date(today);
    nightDate.setDate(nightDate.getDate() + i);

    const progressPercent = 30 + Math.floor((i / forecastDays) * 60);
    progress(`Analyzing night ${i + 1} of ${forecastDays}...`, progressPercent);

    // Yield to event loop so progress updates can render
    await new Promise(resolve => setTimeout(resolve, 0));

    // Calculate night info
    const nightInfo = calculator.getNightInfo(nightDate);

    // Calculate exact moon phase events
    const moonPhaseEvents = getMoonPhaseEvents(nightDate, nightInfo);
    nightInfo.moonPhaseExact = moonPhaseEvents.tonightEvent;

    // Calculate local sidereal time at midnight
    const midnight = new Date(nightInfo.sunset);
    midnight.setHours(midnight.getHours() + 6);
    nightInfo.localSiderealTimeAtMidnight = getLocalSiderealTime(
      midnight,
      calculator.getLongitude()
    );

    // Calculate planet visibility with constellation and planetary events
    const planets: ObjectVisibility[] = [];
    let jupiterVisible = false;

    // Get Venus peak info for scoring
    const venusPeak = getVenusPeakInfo(nightDate);

    // Get planets near perihelion
    const planetsNearPerihelion = getPlanetsNearPerihelion(nightDate);

    for (const planet of PLANETS) {
      try {
        const visibility = calculator.calculatePlanetVisibility(planet.name, nightInfo);

        if (visibility.isVisible) {
          const body = Astronomy.Body[planet.name as keyof typeof Astronomy.Body];

          // Add constellation
          const constellation = getPlanetConstellation(body, nightInfo.astronomicalDusk, observer);
          visibility.constellation = constellation;

          // Add elongation for inner planets
          if (isInnerPlanet(planet.name)) {
            const elongInfo = getElongationForPlanet(planet.name, nightDate);
            if (elongInfo) {
              visibility.elongationDeg = elongInfo.elongationDeg;
            }
          }

          // Add opposition status for outer planets
          if (isOuterPlanet(planet.name)) {
            const oppInfo = getOppositionForPlanet(planet.name, nightDate);
            if (oppInfo) {
              visibility.isAtOpposition = oppInfo.isActive;
            }
          }

          // Calculate hour angle at peak altitude time
          if (visibility.maxAltitudeTime) {
            visibility.hourAngle = calculator.getHourAngle(body, visibility.maxAltitudeTime);

            // Calculate meridian transit time during the night
            const meridianTime = calculator.getMeridianTransitTime(
              body,
              nightInfo.astronomicalDusk
            );
            if (
              meridianTime &&
              meridianTime >= nightInfo.sunset &&
              meridianTime <= nightInfo.sunrise
            ) {
              visibility.meridianTransitTime = meridianTime;
            }
          }

          // Calculate sun angle for twilight penalty
          visibility.sunAngle = calculator.getSunAngle(body, nightInfo.astronomicalDusk);

          // Calculate heliocentric and geocentric distances
          visibility.heliocentricDistanceAU = calculator.getHeliocentricDistance(body, nightDate);
          visibility.geocentricDistanceAU = calculator.getGeocentricDistance(body, nightDate);

          // Check perihelion status
          const perihelionInfo = isNearPerihelion(planet.name, nightDate);
          visibility.isNearPerihelion = perihelionInfo.isNear;
          visibility.perihelionBoostPercent = perihelionInfo.brightnessBoostPercent;

          // Add Saturn ring info
          if (planet.name.toLowerCase() === 'saturn') {
            visibility.saturnRings = calculator.getSaturnRingInfo(nightDate);
          }

          // Track if Jupiter is visible for moon calculations
          if (planet.name.toLowerCase() === 'jupiter') {
            jupiterVisible = true;
          }

          planets.push(visibility);
        }
      } catch {
        // Planet visibility calculation failed - skip this planet
      }
    }

    // Calculate DSO visibility (full catalog - filtering done in loadOpenNGCCatalog)
    const dsos: ObjectVisibility[] = [];
    for (const dso of dsoCatalog) {
      // Get common name - try catalog first, then lookup by NGC name as fallback
      const baseCommonName = dso.commonName || getCommonName(dso.name);

      // Format common name like CLI: "M42 Orion Nebula" or "Andromeda Galaxy" or just NGC name
      let formattedCommonName: string;
      if (dso.messierNumber !== null) {
        // Messier object: "M{number} {commonName}" or just "M{number}"
        formattedCommonName = baseCommonName
          ? `M${dso.messierNumber} ${baseCommonName}`
          : `M${dso.messierNumber}`;
      } else {
        // Non-Messier: use common name if available, otherwise NGC name
        formattedCommonName = baseCommonName ?? dso.name;
      }

      // Use constellation from catalog, or calculate if not available
      const constellation = dso.constellation || getConstellation(dso.raHours, dso.decDegrees);

      const visibility = calculator.calculateVisibility(
        dso.raHours,
        dso.decDegrees,
        nightInfo,
        dso.name,
        'dso',
        {
          magnitude: dso.magnitude,
          subtype: dso.type,
          angularSizeArcmin: dso.majorAxisArcmin ?? 0,
          surfaceBrightness: dso.surfaceBrightness,
          commonName: formattedCommonName,
          isMessier: dso.messierNumber !== null,
          constellation,
        }
      );

      if (visibility.isVisible) {
        // Add hour angle and meridian transit for DSOs
        if (visibility.maxAltitudeTime) {
          visibility.hourAngle = calculator.getHourAngleForRA(
            dso.raHours,
            visibility.maxAltitudeTime
          );
          visibility.meridianTransitTime =
            calculator.getMeridianTransitTimeForRA(dso.raHours, nightInfo.astronomicalDusk) ??
            undefined;
        }

        // Calculate sun angle
        visibility.sunAngle = calculator.getSunAngleForPosition(
          dso.raHours,
          dso.decDegrees,
          nightInfo.astronomicalDusk
        );

        dsos.push(visibility);
      }
    }

    // Calculate comet visibility
    const comets: ObjectVisibility[] = [];
    for (const comet of cometCatalog) {
      const visibility = calculateCometVisibility(
        comet,
        calculator,
        nightInfo,
        settings.cometMagnitude
      );
      if (visibility) {
        comets.push(visibility);
      }
    }

    // Calculate dwarf planet visibility
    const dwarfPlanetVisibility: ObjectVisibility[] = [];
    for (const dp of dwarfPlanets) {
      const visibility = calculateMinorPlanetVisibility(
        dp,
        calculator,
        nightInfo,
        settings.cometMagnitude // Use comet magnitude limit for minor planets
      );
      if (visibility) {
        dwarfPlanetVisibility.push(visibility);
      }
    }

    // Calculate asteroid visibility
    const asteroidVisibility: ObjectVisibility[] = [];
    for (const asteroid of asteroids) {
      const visibility = calculateMinorPlanetVisibility(
        asteroid,
        calculator,
        nightInfo,
        settings.cometMagnitude
      );
      if (visibility) {
        asteroidVisibility.push(visibility);
      }
    }

    // Calculate Milky Way visibility
    const milkyWay = calculator.calculateMilkyWayVisibility(nightInfo);
    // Add constellation for Milky Way center
    milkyWay.constellation = 'Sagittarius';

    // Calculate Moon visibility with libration
    const moon = calculator.calculateMoonVisibility(nightInfo);
    moon.libration = getLibrationForNight(nightDate);

    // Parse weather for this night
    let weather: NightWeather | null = null;
    if (weatherData) {
      try {
        weather = parseNightWeather(weatherData, airQualityData, nightInfo);
      } catch {
        // Weather parsing failed - continue without weather data
      }
    }

    // Calculate seeing forecast based on weather
    nightInfo.seeingForecast = getSeeingFromWeather(weather);

    // Detect conjunctions
    const conjunctions = detectConjunctions(observer, planets, nightInfo);

    // Detect meteor showers
    const meteorShowers = detectMeteorShowers(calculator, nightInfo);

    // Calculate astronomical events for this night
    const lunarApsis = getLunarApsisForNight(nightInfo);
    const eclipses = detectEclipses(nightDate, observer, 1); // Just check this day
    const seasonalMarker = detectSeasonalMarkers(nightDate, 1); // Check if today has a marker
    const jupiterMoons = jupiterVisible ? getJupiterMoonsData(nightInfo, true) : null;

    // Get eclipse season info
    const eclipseSeason = getEclipseSeasonInfo(nightDate);

    // Get planetary transit info (rare events)
    const planetaryTransit = getTransitForDisplay(nightDate);

    // Build astronomical events object
    const astronomicalEvents: AstronomicalEvents = {
      lunarEclipse: eclipses.lunar,
      solarEclipse: eclipses.solar,
      jupiterMoons,
      lunarApsis,
      oppositions: oppositions.filter(o => {
        // Include oppositions that are active or within a few days
        const daysDiff = (o.date.getTime() - nightDate.getTime()) / (1000 * 60 * 60 * 24);
        return Math.abs(daysDiff) <= 14;
      }),
      maxElongations: maxElongations.filter(e => {
        const daysDiff = (e.date.getTime() - nightDate.getTime()) / (1000 * 60 * 60 * 24);
        return Math.abs(daysDiff) <= 7;
      }),
      seasonalMarker,
      // New event fields
      moonPhaseEvent: moonPhaseEvents.tonightEvent,
      nextMoonPhase: moonPhaseEvents.next,
      planetPerihelia: planetsNearPerihelion,
      eclipseSeason: eclipseSeason?.isActive ? eclipseSeason : null,
      venusPeak,
      planetaryTransit,
    };

    // Create forecast
    const forecast: NightForecast = {
      nightInfo,
      planets,
      dsos,
      comets,
      dwarfPlanets: dwarfPlanetVisibility,
      asteroids: asteroidVisibility,
      milkyWay: milkyWay.isVisible ? milkyWay : null,
      moon,
      weather,
      conjunctions,
      meteorShowers,
      astronomicalEvents,
    };

    forecasts.push(forecast);

    // Score all objects
    const sunPos = calculator.getSunPosition(nightDate);
    const allObjects: ObjectVisibility[] = [
      ...planets,
      ...dsos,
      ...comets,
      ...dwarfPlanetVisibility,
      ...asteroidVisibility,
      ...(milkyWay.isVisible ? [milkyWay] : []),
      ...(moon.isVisible ? [moon] : []),
    ];

    // Calculate imaging windows for all visible objects
    for (const obj of allObjects) {
      const imagingWindow = getBestImagingWindow(obj, nightInfo, weather);
      if (imagingWindow) {
        obj.imagingWindow = imagingWindow;
      }
    }

    // Score all objects and filter by minimum threshold
    // Don't limit here - let the UI handle display with category grouping
    const scored = allObjects
      .map(obj =>
        calculateTotalScore(
          obj,
          nightInfo,
          weather,
          sunPos.ra,
          astronomicalEvents.oppositions,
          lunarApsis,
          venusPeak
        )
      )
      .filter(s => s.totalScore >= MIN_SCORE_THRESHOLD)
      .sort((a, b) => b.totalScore - a.totalScore);

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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Night scoring requires evaluating multiple factors
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
