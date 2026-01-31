// Core astronomy types
export type ObjectCategory =
  | 'planet'
  | 'dso'
  | 'comet'
  | 'dwarf_planet'
  | 'asteroid'
  | 'milky_way'
  | 'moon';

export type DSOSubtype =
  | 'galaxy'
  | 'galaxy_pair'
  | 'galaxy_triplet'
  | 'galaxy_group'
  | 'emission_nebula'
  | 'reflection_nebula'
  | 'planetary_nebula'
  | 'supernova_remnant'
  | 'nebula'
  | 'hii_region'
  | 'open_cluster'
  | 'globular_cluster'
  | 'double_star'
  | 'asterism'
  | 'star_association'
  | 'dark_nebula'
  | 'other';

export interface NightInfo {
  date: Date;
  sunset: Date;
  sunrise: Date;
  astronomicalDusk: Date;
  astronomicalDawn: Date;
  moonPhase: number;           // 0-1 (0=new, 0.5=full)
  moonIllumination: number;    // 0-100%
  moonRise: Date | null;
  moonSet: Date | null;
}

export interface ObjectVisibility {
  objectName: string;
  objectType: ObjectCategory;
  isVisible: boolean;
  maxAltitude: number;
  maxAltitudeTime: Date | null;
  above45Start: Date | null;
  above45End: Date | null;
  above60Start: Date | null;
  above60End: Date | null;
  above75Start: Date | null;
  above75End: Date | null;
  moonSeparation: number | null;
  moonWarning: boolean;
  magnitude: number | null;
  isInterstellar: boolean;
  altitudeSamples: Array<[Date, number]>;
  subtype: DSOSubtype | null;
  angularSizeArcmin: number;
  surfaceBrightness: number | null;
  raHours: number;
  decDegrees: number;
  commonName: string;
  minAirmass: number;
  azimuthAtPeak: number;
  apparentDiameterArcsec: number | null;
  apparentDiameterMin: number | null;
  apparentDiameterMax: number | null;
  positionAngle: number | null;
  constellation?: string;
  isMessier?: boolean;
}

export interface NightWeather {
  date: Date;
  avgCloudCover: number;
  minCloudCover: number;
  maxCloudCover: number;
  clearDurationHours: number;
  clearWindows: ClearWindow[];
  hourlyData: Map<number, HourlyWeather>;

  avgVisibilityKm: number | null;
  avgWindSpeedKmh: number | null;
  maxWindSpeedKmh: number | null;
  avgHumidity: number | null;
  avgTemperatureC: number | null;
  transparencyScore: number | null;
  cloudCoverLow: number | null;
  cloudCoverMid: number | null;
  cloudCoverHigh: number | null;
  minPrecipProbability: number | null;
  maxPrecipProbability: number | null;
  totalPrecipitationMm: number | null;
  minDewMargin: number | null;
  dewRiskHours: number;
  avgPressureHpa: number | null;
  pressureTrend: 'rising' | 'falling' | 'steady' | null;
  maxCape: number | null;
  bestTime: BestObservingTime | null;
  avgAerosolOpticalDepth: number | null;
  avgPm25: number | null;
  avgPm10: number | null;
  avgDust: number | null;
}

export interface HourlyWeather {
  cloudCover: number;
  visibility: number | null;
  windSpeed: number | null;
  windGust: number | null;
  humidity: number | null;
  temperature: number | null;
  dewPoint: number | null;
  precipProbability: number | null;
  precipitation: number | null;
  pressure: number | null;
  cape: number | null;
  aod: number | null;
  pm25: number | null;
  pm10: number | null;
  dust: number | null;
}

export interface ClearWindow {
  start: Date;
  end: Date;
  avgCloudCover: number;
}

export interface BestObservingTime {
  start: Date;
  end: Date;
  score: number;
  reason: string;
}

export interface NightForecast {
  nightInfo: NightInfo;
  planets: ObjectVisibility[];
  dsos: ObjectVisibility[];
  comets: ObjectVisibility[];
  dwarfPlanets: ObjectVisibility[];
  asteroids: ObjectVisibility[];
  milkyWay: ObjectVisibility | null;
  moon: ObjectVisibility | null;
  weather: NightWeather | null;
  conjunctions: Conjunction[];
  meteorShowers: MeteorShower[];
}

export interface ScoredObject {
  objectName: string;
  category: ObjectCategory;
  subtype: DSOSubtype | null;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  reason: string;
  visibility: ObjectVisibility;
  magnitude: number | null;
}

export interface ScoreBreakdown {
  altitudeScore: number;
  moonInterference: number;
  peakTiming: number;
  weatherScore: number;
  surfaceBrightness: number;
  magnitudeScore: number;
  typeSuitability: number;
  transientBonus: number;
  seasonalWindow: number;
  noveltyPopularity: number;
}

export type ScoreTier = 'excellent' | 'very_good' | 'good' | 'fair' | 'poor';

export interface Conjunction {
  object1Name: string;
  object2Name: string;
  separationDegrees: number;
  time: Date;
  description: string;
  isNotable: boolean;
}

export interface MeteorShower {
  name: string;
  code: string;
  peakMonth: number;
  peakDay: number;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  zhr: number;
  radiantRaDeg: number;
  radiantDecDeg: number;
  velocityKms: number;
  parentObject: string;
  isActive: boolean;
  daysFromPeak: number | null;
  radiantAltitude: number | null;
  moonIllumination: number | null;
  moonSeparationDeg: number | null;
}

export interface Location {
  latitude: number;
  longitude: number;
  name?: string;
  timezone?: string;
}

export interface Settings {
  forecastDays: number;
  maxObjects: number;
  cometMagnitude: number;
  dsoMagnitude: number;
  theme: 'light' | 'dark' | 'system';
}

export interface DSOCatalogEntry {
  name: string;
  type: string;
  raHours: number;
  decDegrees: number;
  magnitude: number | null;
  majorAxisArcmin: number | null;
  minorAxisArcmin: number | null;
  constellation: string;
  messierNumber: number | null;
  commonName: string | null;
  surfaceBrightness: number | null;
}

export interface CometData {
  designation: string;
  name: string;
  absoluteMagnitude: number;
  slopeParameter: number;
  perihelionDistance: number;
  eccentricity: number;
  argumentOfPerihelion: number;
  longitudeOfAscendingNode: number;
  inclination: number;
  perihelionDate: Date;
  epochDate: Date;
  isInterstellar: boolean;
}

export interface PlanetData {
  name: string;
  physicalDiameter: number;
  apparentDiameterMin: number;
  apparentDiameterMax: number;
}
