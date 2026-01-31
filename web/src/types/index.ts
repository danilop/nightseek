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
  moonPhase: number; // 0-1 (0=new, 0.5=full)
  moonIllumination: number; // 0-100%
  moonRise: Date | null;
  moonSet: Date | null;
  // New fields
  moonPhaseExact: MoonPhaseEvent | null;
  localSiderealTimeAtMidnight: string | null;
  seeingForecast: SeeingForecast | null;
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
  altitudeSamples: [Date, number][];
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
  // New planetary event fields
  elongationDeg?: number;
  isAtOpposition?: boolean;
  // Lunar libration
  libration?: LunarLibration;
  // New astronomy-engine fields
  hourAngle?: number; // 0-24 hours; 0 = on meridian
  meridianTransitTime?: Date; // When object crosses meridian
  sunAngle?: number; // Angular distance from Sun (degrees)
  heliocentricDistanceAU?: number; // Distance from Sun
  geocentricDistanceAU?: number; // Distance from Earth
  isNearPerihelion?: boolean; // Planet within 30 days of perihelion
  perihelionBoostPercent?: number; // Brightness boost from perihelion
  imagingWindow?: ImagingWindow; // Best imaging slot
  saturnRings?: SaturnRingInfo; // Saturn ring geometry (Saturn only)
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
  astronomicalEvents: AstronomicalEvents;
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
  // Planetary event bonuses
  oppositionBonus: number; // 0-20
  elongationBonus: number; // 0-15
  supermoonBonus: number; // 0-10
  // New scoring factors
  perihelionBonus: number; // 0-10 (planet within 30 days of perihelion)
  meridianBonus: number; // 0-5 (object within 1hr of meridian)
  twilightPenalty: number; // -30 to 0 (object close to Sun)
  venusPeakBonus: number; // 0-8 (Venus within 14 days of peak)
  seeingQuality: number; // 0-8 (atmospheric conditions)
  dewRiskPenalty: number; // -5 to 0 (high dew probability)
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

// Eclipses
export interface LunarEclipse {
  kind: 'penumbral' | 'partial' | 'total';
  peakTime: Date;
  magnitude: number;
  isVisible: boolean;
  penumbralStart?: Date;
  partialStart?: Date;
  totalStart?: Date;
  totalEnd?: Date;
  partialEnd?: Date;
  penumbralEnd?: Date;
}

export interface SolarEclipse {
  kind: 'partial' | 'annular' | 'total';
  peakTime: Date;
  obscuration: number;
  altitude: number;
}

// Jupiter Moons
export interface GalileanMoonPosition {
  name: 'Io' | 'Europa' | 'Ganymede' | 'Callisto';
  x: number;
  y: number;
  z: number;
  isTransiting: boolean;
  shadowOnJupiter: boolean;
}

export interface GalileanMoonEvent {
  moon: string;
  type: 'transit_start' | 'transit_end' | 'shadow_start' | 'shadow_end';
  time: Date;
}

// Planetary Events
export interface OppositionEvent {
  planet: string;
  date: Date;
  daysUntil: number;
  isActive: boolean; // within 14 days
}

export interface MaxElongation {
  planet: 'Mercury' | 'Venus';
  elongationDeg: number;
  isEastern: boolean;
  date: Date;
  daysUntil: number;
}

// Lunar
export interface LunarApsis {
  type: 'perigee' | 'apogee';
  date: Date;
  distanceKm: number;
  isSupermoon: boolean;
}

export interface LunarLibration {
  longitudeDeg: number;
  latitudeDeg: number;
  description: string;
}

// Seasonal marker
export interface SeasonalMarker {
  type: 'march_equinox' | 'june_solstice' | 'september_equinox' | 'december_solstice';
  time: Date;
  daysUntil: number;
}

// Moon Phase Events
export interface MoonPhaseEvent {
  phase: 'new' | 'first_quarter' | 'full' | 'third_quarter';
  time: Date;
  isTonight: boolean;
  daysUntil: number;
}

// Planetary Transits (Mercury/Venus across Sun)
export interface PlanetaryTransit {
  planet: 'Mercury' | 'Venus';
  start: Date;
  peak: Date;
  finish: Date;
  separationArcmin: number;
  yearsUntil: number;
}

// Planet Perihelion/Aphelion
export interface PlanetApsis {
  planet: string;
  type: 'perihelion' | 'aphelion';
  date: Date;
  distanceAU: number;
  daysUntil: number;
  brightnessBoostPercent: number;
}

// Eclipse Season (lunar node crossing)
export interface EclipseSeason {
  nodeType: 'ascending' | 'descending';
  nodeCrossingTime: Date;
  windowStart: Date;
  windowEnd: Date;
  isActive: boolean;
}

// Venus Peak Brightness
export interface VenusPeakInfo {
  peakDate: Date;
  peakMagnitude: number;
  daysUntil: number;
  isNearPeak: boolean;
}

// Imaging Window (best time to photograph object)
export interface ImagingWindow {
  start: Date;
  end: Date;
  quality: 'excellent' | 'good' | 'acceptable' | 'poor';
  qualityScore: number;
  factors: {
    altitude: number;
    airmass: number;
    moonInterference: number;
    cloudCover: number;
  };
}

// Atmospheric Seeing Forecast
export interface SeeingForecast {
  rating: 'excellent' | 'good' | 'fair' | 'poor';
  estimatedArcsec: number;
  confidence: number;
  recommendation: string;
}

// Saturn Ring Geometry
export interface SaturnRingInfo {
  tiltAngle: number;
  isNorthPoleVisible: boolean;
  openness: 'edge-on' | 'narrow' | 'moderate' | 'wide' | 'maximum';
  description: string;
}

// Dew Risk Timeline Entry
export interface DewRiskEntry {
  hour: Date;
  riskLevel: 'safe' | 'low' | 'moderate' | 'high';
  dewMargin: number; // temperature - dewpoint
}

// Container for all astronomical events
export interface AstronomicalEvents {
  lunarEclipse: LunarEclipse | null;
  solarEclipse: SolarEclipse | null;
  jupiterMoons: { positions: GalileanMoonPosition[]; events: GalileanMoonEvent[] } | null;
  lunarApsis: LunarApsis | null;
  oppositions: OppositionEvent[];
  maxElongations: MaxElongation[];
  seasonalMarker: SeasonalMarker | null;
  // New event fields
  moonPhaseEvent: MoonPhaseEvent | null;
  nextMoonPhase: MoonPhaseEvent | null;
  planetPerihelia: PlanetApsis[];
  eclipseSeason: EclipseSeason | null;
  venusPeak: VenusPeakInfo | null;
  planetaryTransit: PlanetaryTransit | null;
}
