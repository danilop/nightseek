import * as Astronomy from 'astronomy-engine';
import { forecastConfidence as getForecastConfidence } from '@/lib/weather/observing-conditions';
import type {
  AstronomicalEvents,
  DSOCatalogEntry,
  Location,
  MilkyWayPlan,
  NeoCloseApproach,
  NightForecast,
  NightInfo,
  NightWeather,
  ObjectVisibility,
  ScoredObject,
  Settings,
} from '@/types';
import { SkyCalculator } from './astronomy/calculator';
import { getPlanetConstellation } from './astronomy/constellations';
import { calculateDSOVisibility } from './astronomy/dso';
import {
  detectMaxElongations,
  getElongationForPlanet,
  isInnerPlanet,
  isOuterPlanet,
} from './astronomy/elongation';
import { getJupiterMoonsData } from './astronomy/galilean-moons';
import { getLibrationForNight } from './astronomy/libration';
import { getLunarApsisForNight } from './astronomy/lunar-apsis';
import { getEclipseSeasonInfo } from './astronomy/lunar-nodes';
import { calculateMilkyWayPlan, selectMilkyWayRepresentative } from './astronomy/milky-way';
import { getMoonPhaseEvents } from './astronomy/moon-phases';
import { detectOppositions, getOppositionForPlanet } from './astronomy/opposition';
import { getPlanetsNearPerihelion, isNearPerihelion } from './astronomy/planet-apsis';
import { PLANETS } from './astronomy/planets';
import { getSeeingFromWeather } from './astronomy/seeing';
import { getLocalSiderealTime } from './astronomy/sidereal';
import { getVenusPeakInfo } from './astronomy/venus-peak';
import { calculateCometVisibility, fetchComets } from './catalogs/comets';
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
import { firstNightDate, nightDateAtOffset } from './forecast/night-dates';
import { fetchAsteroidPhysicalData } from './jpl/sbdb';
import { computeAuroraForecast, fetchSpaceWeather } from './nasa/donki';
import { fetchNeoCloseApproachesRange } from './nasa/neows';
import { compareTargetScores } from './scoring';
import { scoreTargetForNight } from './scoring/target';
import { getEffectiveFOV } from './telescopes';
import { formatDateKey } from './utils/format';
import { logger } from './utils/logger';
import { determineBestNights } from './weather/night-ranking';
import { fetchAirQuality, fetchWeather, parseNightWeather } from './weather/open-meteo';

export interface ForecastResult {
  forecasts: NightForecast[];
  scoredObjects: Map<string, ScoredObject[]>; // keyed by date ISO string
  bestNights: string[]; // ISO date strings of best nights
  timezone: string; // IANA timezone of observation location
}

interface AllVisibilities {
  planets: ObjectVisibility[];
  dsos: ObjectVisibility[];
  comets: ObjectVisibility[];
  dwarfPlanets: ObjectVisibility[];
  asteroids: ObjectVisibility[];
  milkyWay: MilkyWayPlan;
  moon: ObjectVisibility;
  jupiterVisible: boolean;
}

function errorWithCause(message: string, cause: unknown): Error {
  return Object.assign(new Error(message), { cause });
}

async function withFallback<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch {
    return fallback;
  }
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
          nightInfo.observingWindowStart,
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
          const meridianTime = calculator.getMeridianTransitTime(
            body,
            nightInfo.observingWindowStart
          );
          if (
            meridianTime &&
            meridianTime >= nightInfo.sunset &&
            meridianTime <= nightInfo.sunrise
          ) {
            visibility.meridianTransitTime = meridianTime;
          }
        }

        visibility.sunAngle = calculator.getSunAngle(body, nightInfo.observingWindowStart);
        visibility.heliocentricDistanceAU = calculator.getHeliocentricDistance(body, nightDate);
        visibility.geocentricDistanceAU = calculator.getGeocentricDistance(body, nightDate);

        const perihelionInfo = isNearPerihelion(planet.name, nightDate);
        visibility.isNearPerihelion = perihelionInfo.isNear;
        visibility.perihelionSolarFluxBoostPercent = perihelionInfo.solarFluxBoostPercent;

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
    let visibility: ObjectVisibility;
    try {
      visibility = calculateDSOVisibility(dso, calculator, nightInfo);
    } catch (error) {
      throw errorWithCause(`Invalid deep-sky catalog entry: ${dso.name}`, error);
    }

    if (visibility.isVisible) dsos.push(visibility);
  }

  const comets: ObjectVisibility[] = [];
  for (const comet of cometCatalog) {
    let visibility: ObjectVisibility | null;
    try {
      visibility = calculateCometVisibility(comet, calculator, nightInfo, settings.cometMagnitude);
    } catch (error) {
      // One malformed upstream orbit must not discard the user's entire
      // forecast. Keep the remaining independently valid comet solutions.
      logger.warn(`Skipping invalid comet orbit: ${comet.designation}`, error);
      continue;
    }
    if (visibility) comets.push(visibility);
  }

  const dwarfPlanetVis: ObjectVisibility[] = [];
  for (const dp of dwarfPlanetList) {
    let visibility: ObjectVisibility | null;
    try {
      visibility = calculateMinorPlanetVisibility(
        dp,
        calculator,
        nightInfo,
        settings.cometMagnitude
      );
    } catch (error) {
      throw errorWithCause(`Invalid dwarf-planet orbit: ${dp.name}`, error);
    }
    if (visibility) dwarfPlanetVis.push(visibility);
  }

  const asteroidVis: ObjectVisibility[] = [];
  for (const asteroid of asteroidList) {
    let visibility: ObjectVisibility | null;
    try {
      visibility = calculateMinorPlanetVisibility(
        asteroid,
        calculator,
        nightInfo,
        settings.cometMagnitude
      );
    } catch (error) {
      throw errorWithCause(`Invalid asteroid orbit: ${asteroid.name}`, error);
    }
    if (visibility) {
      const physicalData = await fetchAsteroidPhysicalData(asteroid.name);
      if (physicalData) visibility.physicalData = physicalData;
      asteroidVis.push(visibility);
    }
  }

  let milkyWay: MilkyWayPlan;
  let moon: ObjectVisibility;
  try {
    milkyWay = calculateMilkyWayPlan(calculator, nightInfo);
  } catch (error) {
    throw errorWithCause('Milky Way visibility calculation failed', error);
  }

  try {
    moon = calculator.calculateMoonVisibility(nightInfo);
    moon.libration = getLibrationForNight(nightInfo);
  } catch (error) {
    throw errorWithCause('Moon visibility calculation failed', error);
  }

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
  jupiterVisible: boolean,
  timezone: string
): AstronomicalEvents {
  const lunarApsis = getLunarApsisForNight(nightInfo);
  const eclipses = detectEclipses(nightDate, observer, 1);
  const seasonalMarker = detectSeasonalMarkers(nightDate, 1);
  const jupiterMoons = jupiterVisible ? getJupiterMoonsData(nightInfo, true) : null;
  const eclipseSeason = getEclipseSeasonInfo(nightDate);
  const planetaryTransit = getTransitForDisplay(nightDate);
  const nightDateStr = formatDateKey(nightDate, timezone);
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

  return allObjects
    .map(obj => scoreTargetForNight(obj, nightInfo, weather, calculator, events, fov, sunPos.ra))
    .sort(compareTargetScores);
}

/**
 * Generate a complete forecast for the given location and settings
 */
export async function generateForecast(
  location: Location,
  settings: Settings,
  onProgress?: (message: string, percent: number) => void,
  onPartial?: (result: ForecastResult) => void,
  signal?: AbortSignal,
  referenceDate: Date = new Date()
): Promise<ForecastResult> {
  const { latitude, longitude } = location;
  const { forecastDays, dsoMagnitude } = settings;

  const progress = (msg: string, pct: number) => onProgress?.(msg, pct);

  // Initialize calculator
  progress('Initializing astronomical calculator...', 5);
  const calculator = new SkyCalculator(latitude, longitude);
  const observer = new Astronomy.Observer(latitude, longitude, 0);

  // Start independent data sources together. On a cold load this removes a
  // catalog → comet → weather → air-quality network waterfall.
  progress('Loading catalogs and observing conditions...', 10);
  const spaceWeatherPromise = withFallback(() => fetchSpaceWeather(), null);
  const [dsoCatalog, cometCatalog, weatherData, airQualityData] = await Promise.all([
    withFallback(
      () =>
        loadOpenNGCCatalog({
          maxMagnitude: dsoMagnitude,
          observerLatitude: latitude,
          // Keep every object that can physically rise. The user's global and
          // directional horizon profile applies the desired imaging cutoff later.
          minAltitude: 0,
        }),
      [] as DSOCatalogEntry[]
    ),
    withFallback(() => fetchComets(settings.cometMagnitude), []),
    withFallback(() => fetchWeather(latitude, longitude, forecastDays), null),
    withFallback(() => fetchAirQuality(latitude, longitude, forecastDays), null),
  ]);

  // Load minor planets (dwarf planets and asteroids)
  const dwarfPlanets = getDwarfPlanets();
  const asteroids = getNotableAsteroids();

  progress('Preparing astronomical calculations...', 20);

  // Extract authoritative timezone from Open-Meteo response
  const locationTimezone =
    weatherData?.timezone ?? location.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Generate forecasts for each night
  const forecasts: NightForecast[] = [];
  const scoredObjects = new Map<string, ScoredObject[]>();

  // Anchor "tonight" to noon in the selected location, not the device timezone.
  const today = firstNightDate(referenceDate, locationTimezone, calculator);

  // Start the location-dependent NEO request before synchronous event work so
  // its network latency overlaps those calculations.
  const neoDataPromise = withFallback(
    () => fetchNeoCloseApproachesRange(today, forecastDays, locationTimezone),
    new Map<string, NeoCloseApproach[]>()
  );

  // Pre-calculate planetary events for the forecast window (cache these)
  progress('Calculating planetary events...', 25);
  const oppositions = detectOppositions(today, forecastDays);
  const maxElongations = detectMaxElongations(today, forecastDays);

  // Both feeds are independent and were started as early as their inputs allowed.
  const [neoDataByDate, spaceWeather] = await Promise.all([neoDataPromise, spaceWeatherPromise]);

  // Compute effective FOV for scoring
  const fov = getEffectiveFOV(settings.telescope, settings.customFOV);

  for (let i = 0; i < forecastDays; i++) {
    signal?.throwIfAborted();
    // Advance civil dates from the selected location's noon anchor. Using
    // setDate() here would apply the device's DST rules, which may be unrelated
    // to the observing location.
    const nightDate = nightDateAtOffset(today, locationTimezone, i);

    const progressPercent = 30 + Math.floor((i / forecastDays) * 60);
    progress(`Analyzing night ${i + 1} of ${forecastDays}...`, progressPercent);

    // Yield to event loop so progress updates can render
    await new Promise(resolve => setTimeout(resolve, 0));

    // Calculate night info
    const nightInfo = calculator.getNightInfo(nightDate);

    // Calculate exact moon phase events
    const moonPhaseEvents = getMoonPhaseEvents(nightDate, nightInfo);
    nightInfo.moonPhaseExact = moonPhaseEvents.tonightEvent;

    // Calculate local sidereal time at midnight (UTC midpoint of astronomical night)
    const midnight = new Date(
      (nightInfo.observingWindowStart.getTime() + nightInfo.observingWindowEnd.getTime()) / 2
    );
    nightInfo.localSiderealTimeAtMidnight = getLocalSiderealTime(
      midnight,
      calculator.getLongitude()
    );

    // Calculate all object visibilities
    let vis: Awaited<ReturnType<typeof calculateAllVisibilities>>;
    try {
      vis = await calculateAllVisibilities(
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
    } catch (error) {
      throw errorWithCause(`Visibility calculation failed for ${nightDate.toISOString()}`, error);
    }

    // Parse weather for this night
    let weather: NightWeather | null = null;
    if (weatherData) {
      try {
        weather = parseNightWeather(weatherData, airQualityData, nightInfo);
      } catch {
        // Weather parsing failed
      }
    }

    const forecastConfidence = getForecastConfidence(weather, nightInfo);

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
      vis.jupiterVisible,
      locationTimezone
    );

    // Create forecast
    const forecast: NightForecast = {
      nightInfo,
      planets: vis.planets,
      dsos: vis.dsos,
      comets: vis.comets,
      dwarfPlanets: vis.dwarfPlanets,
      asteroids: vis.asteroids,
      // Keep the complete band and core geometry even when parts are below the
      // usable night window so the planner can explain every outcome.
      milkyWay: vis.milkyWay,
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
      selectMilkyWayRepresentative(vis.milkyWay),
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

    scoredObjects.set(formatDateKey(nightDate, locationTimezone), scored);
    // Publish completed nights immediately. New containers keep React snapshots
    // immutable; the worker transport also preserves Date and Map values.
    onPartial?.({
      forecasts: [...forecasts],
      scoredObjects: new Map(scoredObjects),
      bestNights: determineBestNights(forecasts, locationTimezone),
      timezone: locationTimezone,
    });
  }

  // Determine best nights
  progress('Determining best observation nights...', 95);
  const bestNights = determineBestNights(forecasts, locationTimezone);

  progress('Complete!', 100);

  return {
    forecasts,
    scoredObjects,
    bestNights,
    timezone: locationTimezone,
  };
}
