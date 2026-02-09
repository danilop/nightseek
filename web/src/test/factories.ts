import type {
  AstronomicalEvents,
  NightForecast,
  NightInfo,
  NightWeather,
  ObjectVisibility,
  ScoreBreakdown,
  ScoredObject,
} from '@/types';

export function createMockNightInfo(overrides: Partial<NightInfo> = {}): NightInfo {
  return {
    date: new Date('2025-01-15'),
    sunset: new Date('2025-01-15T17:00:00'),
    sunrise: new Date('2025-01-16T07:00:00'),
    astronomicalDusk: new Date('2025-01-15T18:30:00'),
    astronomicalDawn: new Date('2025-01-16T05:30:00'),
    moonPhase: 0.25,
    moonIllumination: 50,
    moonRise: new Date('2025-01-15T12:00:00'),
    moonSet: new Date('2025-01-16T02:00:00'),
    moonPhaseExact: null,
    localSiderealTimeAtMidnight: '12:00:00',
    seeingForecast: null,
    ...overrides,
  };
}

export function createMockNightWeather(overrides: Partial<NightWeather> = {}): NightWeather {
  return {
    date: new Date('2025-01-15'),
    avgCloudCover: 20,
    minCloudCover: 10,
    maxCloudCover: 30,
    clearDurationHours: 8,
    clearWindows: [],
    hourlyData: new Map(),
    avgVisibilityKm: 10,
    avgWindSpeedKmh: 15,
    maxWindSpeedKmh: 25,
    avgHumidity: 60,
    avgTemperatureC: 5,
    transparencyScore: 75,
    cloudCoverLow: 10,
    cloudCoverMid: 15,
    cloudCoverHigh: 20,
    minPrecipProbability: 0,
    maxPrecipProbability: 10,
    totalPrecipitationMm: 0,
    minDewMargin: 5,
    dewRiskHours: 1,
    avgPressureHpa: 1013,
    pressureTrend: 'steady',
    maxCape: 0,
    bestTime: null,
    avgAerosolOpticalDepth: 0.1,
    avgPm25: 10,
    avgPm10: 20,
    avgDust: 5,
    ...overrides,
  };
}

export function createMockObjectVisibility(
  overrides: Partial<ObjectVisibility> = {}
): ObjectVisibility {
  return {
    objectName: 'M31',
    objectType: 'dso',
    isVisible: true,
    maxAltitude: 65,
    maxAltitudeTime: new Date('2025-01-16T00:00:00'),
    above45Start: new Date('2025-01-15T22:00:00'),
    above45End: new Date('2025-01-16T02:00:00'),
    above60Start: new Date('2025-01-15T23:00:00'),
    above60End: new Date('2025-01-16T01:00:00'),
    above75Start: null,
    above75End: null,
    moonSeparation: 90,
    moonWarning: false,
    magnitude: 3.4,
    isInterstellar: false,
    altitudeSamples: [],
    subtype: 'galaxy',
    angularSizeArcmin: 178,
    surfaceBrightness: 22.4,
    raHours: 0.712,
    decDegrees: 41.27,
    commonName: 'Andromeda Galaxy',
    minAirmass: 1.1,
    azimuthAtPeak: 180,
    apparentDiameterArcsec: null,
    apparentDiameterMin: null,
    apparentDiameterMax: null,
    positionAngle: null,
    ...overrides,
  };
}

export function createMockScoreBreakdown(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    altitudeScore: 20,
    moonInterference: 15,
    peakTiming: 10,
    weatherScore: 15,
    surfaceBrightness: 10,
    magnitudeScore: 10,
    typeSuitability: 8,
    transientBonus: 0,
    seasonalWindow: 5,
    noveltyPopularity: 5,
    oppositionBonus: 0,
    elongationBonus: 0,
    supermoonBonus: 0,
    perihelionBonus: 0,
    meridianBonus: 0,
    twilightPenalty: 0,
    venusPeakBonus: 0,
    seeingQuality: 5,
    dewRiskPenalty: 0,
    imagingWindowScore: 15,
    fovSuitability: 10,
    ...overrides,
  };
}

export function createMockScoredObject(overrides: Partial<ScoredObject> = {}): ScoredObject {
  return {
    objectName: 'M31',
    category: 'dso',
    subtype: 'galaxy',
    totalScore: 128,
    scoreBreakdown: createMockScoreBreakdown(),
    reason: 'Excellent visibility with good altitude and low moon interference',
    visibility: createMockObjectVisibility(),
    magnitude: 3.4,
    ...overrides,
  };
}

export function createMockAstronomicalEvents(
  overrides: Partial<AstronomicalEvents> = {}
): AstronomicalEvents {
  return {
    lunarEclipse: null,
    solarEclipse: null,
    jupiterMoons: null,
    lunarApsis: null,
    oppositions: [],
    maxElongations: [],
    seasonalMarker: null,
    moonPhaseEvent: null,
    nextMoonPhase: null,
    planetPerihelia: [],
    eclipseSeason: null,
    venusPeak: null,
    planetaryTransit: null,
    neoCloseApproaches: [],
    spaceWeather: null,
    auroraForecast: null,
    ...overrides,
  };
}

export function createMockNightForecast(overrides: Partial<NightForecast> = {}): NightForecast {
  return {
    nightInfo: createMockNightInfo(),
    planets: [],
    dsos: [],
    comets: [],
    dwarfPlanets: [],
    asteroids: [],
    milkyWay: null,
    moon: null,
    weather: createMockNightWeather(),
    forecastConfidence: 'high',
    conjunctions: [],
    meteorShowers: [],
    astronomicalEvents: createMockAstronomicalEvents(),
    ...overrides,
  };
}
