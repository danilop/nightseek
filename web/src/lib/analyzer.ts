import * as Astronomy from 'astronomy-engine';
import type {
  AstronomicalEvents,
  DSOCatalogEntry,
  Location,
  NightForecast,
  NightInfo,
  NightWeather,
  ObjectVisibility,
  ScoredObject,
  Settings,
} from '@/types';
import { SkyCalculator } from './astronomy/calculator';
import {
  getConstellation,
  getConstellationFullName,
  getPlanetConstellation,
} from './astronomy/constellations';
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
import { fetchAsteroidPhysicalData } from './jpl/sbdb';
import { computeAuroraForecast, fetchSpaceWeather } from './nasa/donki';
import { fetchNeoCloseApproachesRange } from './nasa/neows';
import { calculateTotalScore } from './scoring';
import { getEffectiveFOV } from './telescopes';
import { calculateNightQuality } from './weather/night-quality';
import { fetchAirQuality, fetchWeather, parseNightWeather } from './weather/open-meteo';

const MIN_SCORE_THRESHOLD = 60;

export interface ForecastResult {
  forecasts: NightForecast[];
  scoredObjects: Map<string, ScoredObject[]>; // keyed by date ISO string
  bestNights: string[]; // ISO date strings of best nights
}

interface AllVisibilities {
  planets: ObjectVisibility[];
  dsos: ObjectVisibility[];
  comets: ObjectVisibility[];
  dwarfPlanets: ObjectVisibility[];
  asteroids: ObjectVisibility[];
  milkyWay: ObjectVisibility;
  moon: ObjectVisibility;
  jupiterVisible: boolean;
}

/**
 * Calculate visibility for all object types for a given night.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Visibility calculation covers many object types
async function calculateAllVisibilities(
  calculator: SkyCalculator,
  observer: Astronomy.Observer,
  nightInfo: NightInfo,
  nightDate: Date,
  dsoCatalog: DSOCatalogEntry[],
  cometCatalog: Awaited<ReturnType<typeof fetchComets>>,
  dwarfPlanetList: ReturnType<typeof getDwarfPlanets>,
  asteroidList: ReturnType<typeof getNotableAsteroids>,
  settings: Settings
): Promise<AllVisibilities> {
  const planets: ObjectVisibility[] = [];
  let jupiterVisible = false;

  for (const planet of PLANETS) {
    try {
      const visibility = calculator.calculatePlanetVisibility(planet.name, nightInfo);

      if (visibility.isVisible) {
        const body = Astronomy.Body[planet.name as keyof typeof Astronomy.Body];

        visibility.constellation = getPlanetConstellation(
          body,
          nightInfo.astronomicalDusk,
          observer
        );

        if (isInnerPlanet(planet.name)) {
          const elongInfo = getElongationForPlanet(planet.name, nightDate);
          if (elongInfo) visibility.elongationDeg = elongInfo.elongationDeg;
        }

        if (isOuterPlanet(planet.name)) {
          const oppInfo = getOppositionForPlanet(planet.name, nightDate);
          if (oppInfo) visibility.isAtOpposition = oppInfo.isActive;
        }

        if (visibility.maxAltitudeTime) {
          visibility.hourAngle = calculator.getHourAngle(body, visibility.maxAltitudeTime);
          const meridianTime = calculator.getMeridianTransitTime(body, nightInfo.astronomicalDusk);
          if (
            meridianTime &&
            meridianTime >= nightInfo.sunset &&
            meridianTime <= nightInfo.sunrise
          ) {
            visibility.meridianTransitTime = meridianTime;
          }
        }

        visibility.sunAngle = calculator.getSunAngle(body, nightInfo.astronomicalDusk);
        visibility.heliocentricDistanceAU = calculator.getHeliocentricDistance(body, nightDate);
        visibility.geocentricDistanceAU = calculator.getGeocentricDistance(body, nightDate);

        const perihelionInfo = isNearPerihelion(planet.name, nightDate);
        visibility.isNearPerihelion = perihelionInfo.isNear;
        visibility.perihelionBoostPercent = perihelionInfo.brightnessBoostPercent;

        if (planet.name.toLowerCase() === 'saturn') {
          visibility.saturnRings = calculator.getSaturnRingInfo(nightDate);
        }

        if (planet.name.toLowerCase() === 'jupiter') {
          jupiterVisible = true;
        }

        planets.push(visibility);
      }
    } catch {
      // Planet visibility calculation failed - skip
    }
  }

  const dsos: ObjectVisibility[] = [];
  for (const dso of dsoCatalog) {
    const baseCommonName = dso.commonName || getCommonName(dso.name);
    let formattedCommonName: string;
    if (dso.messierNumber !== null) {
      formattedCommonName = baseCommonName
        ? `M${dso.messierNumber} ${baseCommonName}`
        : `M${dso.messierNumber}`;
    } else {
      formattedCommonName = baseCommonName ?? dso.name;
    }

    const constellation = dso.constellation
      ? getConstellationFullName(dso.constellation)
      : getConstellation(dso.raHours, dso.decDegrees);

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
        minorAxisArcmin: dso.minorAxisArcmin ?? undefined,
        surfaceBrightness: dso.surfaceBrightness,
        commonName: formattedCommonName,
        isMessier: dso.messierNumber !== null,
        constellation,
      }
    );

    if (visibility.isVisible) {
      if (visibility.maxAltitudeTime) {
        visibility.hourAngle = calculator.getHourAngleForRA(
          dso.raHours,
          visibility.maxAltitudeTime
        );
        visibility.meridianTransitTime =
          calculator.getMeridianTransitTimeForRA(dso.raHours, nightInfo.astronomicalDusk) ??
          undefined;
      }
      visibility.sunAngle = calculator.getSunAngleForPosition(
        dso.raHours,
        dso.decDegrees,
        nightInfo.astronomicalDusk
      );
      dsos.push(visibility);
    }
  }

  const comets: ObjectVisibility[] = [];
  for (const comet of cometCatalog) {
    const visibility = calculateCometVisibility(
      comet,
      calculator,
      nightInfo,
      settings.cometMagnitude
    );
    if (visibility) comets.push(visibility);
  }

  const dwarfPlanetVis: ObjectVisibility[] = [];
  for (const dp of dwarfPlanetList) {
    const visibility = calculateMinorPlanetVisibility(
      dp,
      calculator,
      nightInfo,
      settings.cometMagnitude
    );
    if (visibility) dwarfPlanetVis.push(visibility);
  }

  const asteroidVis: ObjectVisibility[] = [];
  for (const asteroid of asteroidList) {
    const visibility = calculateMinorPlanetVisibility(
      asteroid,
      calculator,
      nightInfo,
      settings.cometMagnitude
    );
    if (visibility) {
      const physicalData = await fetchAsteroidPhysicalData(asteroid.name);
      if (physicalData) visibility.physicalData = physicalData;
      asteroidVis.push(visibility);
    }
  }

  const milkyWay = calculator.calculateMilkyWayVisibility(nightInfo);
  milkyWay.constellation = 'Sagittarius';

  const moon = calculator.calculateMoonVisibility(nightInfo);
  moon.libration = getLibrationForNight(nightDate);

  return {
    planets,
    dsos,
    comets,
    dwarfPlanets: dwarfPlanetVis,
    asteroids: asteroidVis,
    milkyWay,
    moon,
    jupiterVisible,
  };
}

/**
 * Build the AstronomicalEvents object for a night.
 */
function buildNightAstronomicalEvents(
  nightDate: Date,
  nightInfo: NightInfo,
  observer: Astronomy.Observer,
  oppositions: ReturnType<typeof detectOppositions>,
  maxElongations: ReturnType<typeof detectMaxElongations>,
  neoDataByDate: Map<
    string,
    Awaited<ReturnType<typeof fetchNeoCloseApproachesRange>> extends Map<string, infer V>
      ? V
      : never
  >,
  spaceWeather: Awaited<ReturnType<typeof fetchSpaceWeather>>,
  latitude: number,
  jupiterVisible: boolean
): AstronomicalEvents {
  const lunarApsis = getLunarApsisForNight(nightInfo);
  const eclipses = detectEclipses(nightDate, observer, 1);
  const seasonalMarker = detectSeasonalMarkers(nightDate, 1);
  const jupiterMoons = jupiterVisible ? getJupiterMoonsData(nightInfo, true) : null;
  const eclipseSeason = getEclipseSeasonInfo(nightDate);
  const planetaryTransit = getTransitForDisplay(nightDate);
  const nightDateStr = nightDate.toISOString().split('T')[0];
  const neoCloseApproaches = neoDataByDate.get(nightDateStr) ?? [];
  const moonPhaseEvents = getMoonPhaseEvents(nightDate, nightInfo);
  const planetsNearPerihelion = getPlanetsNearPerihelion(nightDate);
  const venusPeak = getVenusPeakInfo(nightDate);

  return {
    lunarEclipse: eclipses.lunar,
    solarEclipse: eclipses.solar,
    jupiterMoons,
    lunarApsis,
    oppositions: oppositions.filter(o => {
      const daysDiff = (o.date.getTime() - nightDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.abs(daysDiff) <= 14;
    }),
    maxElongations: maxElongations.filter(e => {
      const daysDiff = (e.date.getTime() - nightDate.getTime()) / (1000 * 60 * 60 * 24);
      return Math.abs(daysDiff) <= 7;
    }),
    seasonalMarker,
    moonPhaseEvent: moonPhaseEvents.tonightEvent,
    nextMoonPhase: moonPhaseEvents.next,
    planetPerihelia: planetsNearPerihelion,
    eclipseSeason: eclipseSeason?.isActive ? eclipseSeason : null,
    venusPeak,
    planetaryTransit,
    neoCloseApproaches,
    spaceWeather,
    auroraForecast: spaceWeather ? computeAuroraForecast(spaceWeather, nightDate, latitude) : null,
  };
}

/**
 * Score all visible objects for a night.
 */
function scoreNightObjects(
  allObjects: ObjectVisibility[],
  nightInfo: NightInfo,
  weather: NightWeather | null,
  calculator: SkyCalculator,
  nightDate: Date,
  events: AstronomicalEvents,
  fov: { width: number; height: number } | null
): ScoredObject[] {
  const sunPos = calculator.getSunPosition(nightDate);

  // Calculate imaging windows
  for (const obj of allObjects) {
    const imagingWindow = getBestImagingWindow(obj, nightInfo, weather);
    if (imagingWindow) obj.imagingWindow = imagingWindow;
  }

  return allObjects
    .map(obj =>
      calculateTotalScore(
        obj,
        nightInfo,
        weather,
        sunPos.ra,
        events.oppositions,
        events.lunarApsis,
        events.venusPeak,
        fov
      )
    )
    .filter(s => s.totalScore >= MIN_SCORE_THRESHOLD)
    .sort((a, b) => b.totalScore - a.totalScore);
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

  try {
    weatherData = await fetchWeather(latitude, longitude, forecastDays);
  } catch {
    // Weather fetch failed - continue without weather data
  }

  try {
    airQualityData = await fetchAirQuality(latitude, longitude, forecastDays);
  } catch {
    // Air quality fetch failed - continue without air quality data
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

  // Pre-fetch NEO close approaches for the entire forecast window (single batched call)
  const neoDataByDate = await fetchNeoCloseApproachesRange(today, forecastDays);

  // Pre-fetch space weather data (DONKI)
  const spaceWeather = await fetchSpaceWeather();

  // Compute effective FOV for scoring
  const fov = getEffectiveFOV(settings.telescope, settings.customFOV);

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

    // Calculate all object visibilities
    const vis = await calculateAllVisibilities(
      calculator,
      observer,
      nightInfo,
      nightDate,
      dsoCatalog,
      cometCatalog,
      dwarfPlanets,
      asteroids,
      settings
    );

    // Parse weather for this night
    let weather: NightWeather | null = null;
    if (weatherData) {
      try {
        weather = parseNightWeather(weatherData, airQualityData, nightInfo);
      } catch {
        // Weather parsing failed
      }
    }

    const forecastConfidence: 'high' | 'medium' | 'low' =
      weather !== null && weather.avgAerosolOpticalDepth !== null
        ? 'high'
        : weather !== null
          ? 'medium'
          : 'low';

    nightInfo.seeingForecast = getSeeingFromWeather(weather);

    // Build events
    const conjunctions = detectConjunctions(observer, vis.planets, nightInfo);
    const meteorShowers = detectMeteorShowers(calculator, nightInfo);
    const astronomicalEvents = buildNightAstronomicalEvents(
      nightDate,
      nightInfo,
      observer,
      oppositions,
      maxElongations,
      neoDataByDate,
      spaceWeather,
      latitude,
      vis.jupiterVisible
    );

    // Create forecast
    const forecast: NightForecast = {
      nightInfo,
      planets: vis.planets,
      dsos: vis.dsos,
      comets: vis.comets,
      dwarfPlanets: vis.dwarfPlanets,
      asteroids: vis.asteroids,
      milkyWay: vis.milkyWay.isVisible ? vis.milkyWay : null,
      moon: vis.moon,
      weather,
      forecastConfidence,
      conjunctions,
      meteorShowers,
      astronomicalEvents,
    };

    forecasts.push(forecast);

    // Score all objects
    const allObjects: ObjectVisibility[] = [
      ...vis.planets,
      ...vis.dsos,
      ...vis.comets,
      ...vis.dwarfPlanets,
      ...vis.asteroids,
      ...(vis.milkyWay.isVisible ? [vis.milkyWay] : []),
      ...(vis.moon.isVisible ? [vis.moon] : []),
    ];

    const scored = scoreNightObjects(
      allObjects,
      nightInfo,
      weather,
      calculator,
      nightDate,
      astronomicalEvents,
      fov
    );

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
 * Determine the best nights based on night quality score.
 * Uses the same scoring system as the displayed night rating for consistency.
 * Only considers nights that have a valid observation window (bestTime).
 */
function determineBestNights(forecasts: NightForecast[]): string[] {
  const nightScores: Array<{ date: string; score: number }> = [];

  for (const forecast of forecasts) {
    // Only consider nights with a valid observation window
    // This ensures "best nights" always have a usable observation period
    if (!forecast.weather?.bestTime) {
      continue;
    }

    // Use the same night quality calculation as displayed in the UI
    // This ensures the "best nights" badge aligns with the star rating shown
    const quality = calculateNightQuality(forecast.weather, forecast.nightInfo);

    nightScores.push({
      date: forecast.nightInfo.date.toISOString().split('T')[0],
      score: quality.score,
    });
  }

  // Sort by score and return top nights (up to 3)
  // Only include nights with at least a "fair" score (40+)
  return nightScores
    .filter(n => n.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(n => n.date);
}
