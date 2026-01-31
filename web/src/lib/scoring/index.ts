import type {
  ObjectVisibility,
  ObjectCategory,
  DSOSubtype,
  NightWeather,
  NightInfo,
  ScoredObject,
  ScoreBreakdown,
  ScoreTier,
  OppositionEvent,
  LunarApsis,
} from '@/types';

/**
 * Calculate altitude score based on airmass (0-40 points)
 */
export function calculateAltitudeScore(airmass: number, altitude: number): number {
  // Prefer airmass-based scoring if available
  if (airmass !== Infinity && airmass > 0) {
    if (airmass <= 1.05) return 38;
    if (airmass <= 1.15) return 36;
    if (airmass <= 1.41) return 30;
    if (airmass <= 2.0) return 22;
    if (airmass <= 3.0) return 12;
    return 4;
  }

  // Fallback to altitude-based scoring
  if (altitude >= 75) return 38;
  if (altitude >= 60) return 34;
  if (altitude >= 45) return 28;
  if (altitude >= 30) return 20;
  return 12;
}

/**
 * Get moon sensitivity factor for DSO subtypes
 */
function getMoonSensitivity(subtype: DSOSubtype | null): number {
  switch (subtype) {
    case 'reflection_nebula': return 0.95;
    case 'emission_nebula': return 0.90;
    case 'galaxy': return 0.80;
    case 'supernova_remnant': return 0.85;
    case 'planetary_nebula': return 0.50;
    case 'globular_cluster': return 0.40;
    case 'open_cluster': return 0.30;
    case 'double_star': return 0.10;
    default: return 0.70;
  }
}

/**
 * Calculate moon interference score (0-30 points)
 * Higher score = LESS interference (better)
 */
export function calculateMoonInterference(
  moonIllumination: number,
  moonSeparation: number | null,
  objectType: ObjectCategory,
  subtype: DSOSubtype | null
): number {
  // Planets are less affected
  if (objectType === 'planet') return 27;

  // Dark sky bonus
  if (moonIllumination < 5) return 30;

  // Calculate base from separation (inverted - higher separation = higher score)
  let score = 0;
  if (moonSeparation !== null) {
    if (moonSeparation > 90) score = 30;
    else if (moonSeparation > 60) score = 24;
    else if (moonSeparation > 30) score = 15;
    else score = 6;
  } else {
    score = 15; // Default if unknown
  }

  // Apply illumination penalty
  const illumPenalty = (moonIllumination / 100) * 0.5;
  score = score * (1 - illumPenalty);

  // Apply sensitivity factor for DSO subtypes
  const sensitivity = getMoonSensitivity(subtype);
  const penalty = (30 - score) * sensitivity;
  score = 30 - penalty;

  return Math.round(Math.max(0, Math.min(30, score)));
}

/**
 * Calculate peak timing score (0-15 points)
 */
export function calculatePeakTimingScore(
  peakTime: Date | null,
  dusk: Date,
  dawn: Date
): number {
  if (!peakTime) return 3;

  const peakMs = peakTime.getTime();
  const duskMs = dusk.getTime();
  const dawnMs = dawn.getTime();

  // Check if within observation window
  if (peakMs >= duskMs && peakMs <= dawnMs) return 15;

  // Calculate hours outside window
  const hoursOutside = Math.min(
    Math.abs(peakMs - duskMs),
    Math.abs(peakMs - dawnMs)
  ) / (60 * 60 * 1000);

  if (hoursOutside < 1) return 12;
  if (hoursOutside < 2) return 9;
  if (hoursOutside < 4) return 6;
  return 3;
}

/**
 * Calculate weather score (0-15 points)
 */
export function calculateWeatherScore(
  weather: NightWeather | null,
  objectType: ObjectCategory,
  _subtype: DSOSubtype | null
): number {
  if (!weather) return 7.5; // Default middle score

  const isDeepSky = objectType === 'dso' || objectType === 'milky_way' || objectType === 'comet';
  const isPlanet = objectType === 'planet';

  const cloudCover = weather.avgCloudCover;
  const aod = weather.avgAerosolOpticalDepth;
  const precipProbability = weather.maxPrecipProbability;
  const windGustKmh = weather.maxWindSpeedKmh;
  const transparency = weather.transparencyScore;

  // Base score from cloud cover
  let baseScore: number;
  if (cloudCover < 10) baseScore = 1.0;
  else if (cloudCover < 25) baseScore = 0.9;
  else if (cloudCover < 50) baseScore = 0.6;
  else if (cloudCover < 75) baseScore = 0.3;
  else baseScore = 0.1;

  // AOD penalty
  let aodFactor = 1.0;
  if (aod !== null) {
    if (isDeepSky) {
      if (aod < 0.1) aodFactor = 1.0;
      else if (aod < 0.2) aodFactor = 0.95;
      else if (aod < 0.3) aodFactor = 0.85;
      else if (aod < 0.5) aodFactor = 0.70;
      else aodFactor = 0.50;
    } else {
      if (aod < 0.1) aodFactor = 1.0;
      else if (aod < 0.2) aodFactor = 0.98;
      else if (aod < 0.3) aodFactor = 0.92;
      else if (aod < 0.5) aodFactor = 0.85;
      else aodFactor = 0.75;
    }
  }

  // Transparency bonus (deep sky only)
  let transparencyFactor = 1.0;
  if (isDeepSky && transparency !== null) {
    if (transparency >= 80) transparencyFactor = 1.05;
    else if (transparency >= 60) transparencyFactor = 1.0;
    else if (transparency >= 40) transparencyFactor = 0.9;
    else transparencyFactor = 0.75;
  }

  // Precipitation penalty
  let precipFactor = 1.0;
  if (precipProbability !== null) {
    if (precipProbability <= 10) precipFactor = 1.0;
    else if (precipProbability <= 30) precipFactor = 0.9;
    else if (precipProbability <= 50) precipFactor = 0.7;
    else if (precipProbability <= 70) precipFactor = 0.5;
    else precipFactor = 0.3;
  }

  // Wind penalty
  let windFactor = 1.0;
  if (windGustKmh !== null) {
    if (isPlanet) {
      if (windGustKmh < 15) windFactor = 1.0;
      else if (windGustKmh < 25) windFactor = 0.98;
      else if (windGustKmh < 40) windFactor = 0.92;
      else if (windGustKmh < 55) windFactor = 0.80;
      else windFactor = 0.60;
    } else {
      if (windGustKmh < 15) windFactor = 1.0;
      else if (windGustKmh < 25) windFactor = 0.95;
      else if (windGustKmh < 40) windFactor = 0.80;
      else if (windGustKmh < 55) windFactor = 0.60;
      else windFactor = 0.40;
    }
  }

  // Combine factors and scale to 0-15
  const composite = baseScore * aodFactor * transparencyFactor * precipFactor * windFactor;
  return Math.round(composite * 15);
}

/**
 * Surface brightness score for DSOs (0-20 points)
 */
export function calculateSurfaceBrightnessScore(
  surfaceBrightness: number | null,
  magnitude: number | null,
  angularSizeArcmin: number
): number {
  let sb = surfaceBrightness;

  // Estimate if not provided
  if (sb === null && magnitude !== null && angularSizeArcmin > 0) {
    const areaArcsec2 = Math.PI * Math.pow((angularSizeArcmin * 60) / 2, 2);
    sb = magnitude + 2.5 * Math.log10(Math.max(areaArcsec2, 1));
  }

  if (sb === null) return 10; // Default middle score

  if (sb < 20) return 20;
  if (sb < 22) return 16;
  if (sb < 24) return 12;
  if (sb < 26) return 8;
  return 4;
}

/**
 * Magnitude score (0-15 points)
 */
export function calculateMagnitudeScore(
  magnitude: number | null,
  objectType: ObjectCategory
): number {
  if (magnitude === null) return 7.5;

  if (objectType === 'planet') {
    if (magnitude < -2) return 15;
    if (magnitude < 0) return 13.5;
    if (magnitude < 2) return 10.5;
    return 7.5;
  }

  if (objectType === 'comet' || objectType === 'asteroid' || objectType === 'dwarf_planet') {
    if (magnitude < 6) return 15;
    if (magnitude < 8) return 12;
    if (magnitude < 10) return 9;
    if (magnitude < 12) return 6;
    return 3;
  }

  // DSOs
  if (magnitude < 5) return 15;
  if (magnitude < 7) return 13.5;
  if (magnitude < 9) return 10.5;
  if (magnitude < 11) return 7.5;
  if (magnitude < 13) return 4.5;
  return 3;
}

/**
 * Type suitability score based on moon conditions (0-15 points)
 */
export function calculateTypeSuitabilityScore(
  objectType: ObjectCategory,
  subtype: DSOSubtype | null,
  moonIllumination: number
): number {
  const isDarkSky = moonIllumination < 30;

  if (isDarkSky) {
    if (objectType === 'milky_way') return 15;
    if (subtype === 'emission_nebula' || subtype === 'reflection_nebula' || subtype === 'galaxy') return 14.25;
    if (subtype === 'planetary_nebula' || subtype === 'supernova_remnant') return 12.75;
    if (objectType === 'comet') return 12;
    if (subtype === 'globular_cluster' || subtype === 'open_cluster') return 10.5;
    if (objectType === 'planet') return 9;
    return 7.5;
  } else {
    // Bright moon - prioritize moon-resistant targets
    if (objectType === 'planet') return 15;
    if (subtype === 'globular_cluster' || subtype === 'open_cluster') return 13.5;
    if (subtype === 'planetary_nebula') return 10.5;
    if (objectType === 'comet') return 7.5;
    if (subtype === 'galaxy' || subtype === 'emission_nebula') return 4.5;
    if (objectType === 'milky_way') return 1.5;
    return 6;
  }
}

/**
 * Transient bonus for rare/time-sensitive objects (0-25 points)
 */
export function calculateTransientBonus(
  objectType: ObjectCategory,
  isInterstellar: boolean
): number {
  if (isInterstellar) return 25; // Extremely rare!

  if (objectType === 'comet') return 12.5;
  if (objectType === 'asteroid') return 7.5;

  return 0; // Static objects
}

/**
 * Seasonal window bonus (0-15 points)
 * Objects opposite the sun score higher
 */
export function calculateSeasonalWindowScore(
  objectRaHours: number,
  sunRaHours: number
): number {
  // Calculate RA difference (0-24 hours)
  let raDiff = Math.abs(objectRaHours - sunRaHours);
  if (raDiff > 12) raDiff = 24 - raDiff;

  // Best when RA diff = 12 (opposite sun)
  return 15 * (1 - Math.abs(raDiff - 12) / 12);
}

/**
 * Novelty/popularity bonus (0-10 points)
 */
export function calculateNoveltyScore(
  isMessier: boolean,
  hasCommonName: boolean
): number {
  if (isMessier) return 10;
  if (hasCommonName) return 5;
  return 0;
}

/**
 * Opposition bonus for outer planets (0-20 points)
 * Maximum bonus when at opposition, decreasing as days from opposition increase
 */
export function calculateOppositionBonus(
  planetName: string,
  isAtOpposition: boolean | undefined,
  oppositions: OppositionEvent[]
): number {
  // Check if this planet is at opposition
  if (isAtOpposition === true) {
    return 20;
  }

  // Check oppositions list for this planet
  const opposition = oppositions.find(
    o => o.planet.toLowerCase() === planetName.toLowerCase()
  );

  if (!opposition) return 0;

  if (opposition.isActive) {
    // Scale bonus based on days from opposition (14 day window)
    const daysFactor = Math.max(0, 1 - Math.abs(opposition.daysUntil) / 14);
    return Math.round(20 * daysFactor);
  }

  return 0;
}

/**
 * Elongation bonus for inner planets (0-15 points)
 * Maximum bonus at maximum elongation
 */
export function calculateElongationBonus(
  elongationDeg: number | undefined,
  planetName: string
): number {
  if (elongationDeg === undefined) return 0;

  // Only Mercury and Venus have meaningful elongation
  const lowerName = planetName.toLowerCase();
  if (lowerName !== 'mercury' && lowerName !== 'venus') return 0;

  // Maximum elongation values
  const maxElongation = lowerName === 'mercury' ? 28 : 47;

  // Score based on how close to max elongation
  const elongationRatio = elongationDeg / maxElongation;

  // Higher score when closer to max elongation
  if (elongationRatio >= 0.9) return 15;
  if (elongationRatio >= 0.8) return 12;
  if (elongationRatio >= 0.7) return 9;
  if (elongationRatio >= 0.6) return 6;
  if (elongationRatio >= 0.5) return 3;

  return 0;
}

/**
 * Supermoon bonus for Moon photography (0-10 points)
 */
export function calculateSupermoonBonus(
  lunarApsis: LunarApsis | null,
  moonIllumination: number,
  objectType: ObjectCategory
): number {
  // Only applies to the Moon
  if (objectType !== 'moon') return 0;

  // Check if we have a supermoon
  if (lunarApsis?.isSupermoon) {
    return 10;
  }

  // Partial bonus for perigee near full moon
  if (lunarApsis?.type === 'perigee' && moonIllumination >= 80) {
    return 5;
  }

  return 0;
}

/**
 * Calculate total score for an object
 */
export function calculateTotalScore(
  visibility: ObjectVisibility,
  nightInfo: NightInfo,
  weather: NightWeather | null,
  sunRaHours: number,
  oppositions: OppositionEvent[] = [],
  lunarApsis: LunarApsis | null = null
): ScoredObject {
  const {
    objectType,
    subtype,
    magnitude,
    minAirmass,
    maxAltitude,
    maxAltitudeTime,
    moonSeparation,
    raHours,
    angularSizeArcmin,
    surfaceBrightness,
    isInterstellar,
    isMessier,
    commonName,
    objectName,
    elongationDeg,
    isAtOpposition,
  } = visibility;

  const moonIllumination = nightInfo.moonIllumination;

  // Imaging Quality (0-100)
  const altitudeScore = calculateAltitudeScore(minAirmass, maxAltitude);
  const moonInterference = calculateMoonInterference(moonIllumination, moonSeparation, objectType, subtype);
  const peakTiming = calculatePeakTimingScore(maxAltitudeTime, nightInfo.astronomicalDusk, nightInfo.astronomicalDawn);
  const weatherScore = calculateWeatherScore(weather, objectType, subtype);

  // Object Characteristics (0-50)
  const surfaceBrightnessScore = objectType === 'dso'
    ? calculateSurfaceBrightnessScore(surfaceBrightness, magnitude, angularSizeArcmin)
    : 10;
  const magnitudeScore = calculateMagnitudeScore(magnitude, objectType);
  const typeSuitability = calculateTypeSuitabilityScore(objectType, subtype, moonIllumination);

  // Priority/Rarity (0-50)
  const transientBonus = calculateTransientBonus(objectType, isInterstellar);
  const seasonalWindow = calculateSeasonalWindowScore(raHours, sunRaHours);
  const noveltyPopularity = calculateNoveltyScore(isMessier ?? false, commonName !== objectName);

  // New planetary/lunar bonuses (0-45)
  const oppositionBonus = objectType === 'planet'
    ? calculateOppositionBonus(objectName, isAtOpposition, oppositions)
    : 0;
  const elongationBonus = objectType === 'planet'
    ? calculateElongationBonus(elongationDeg, objectName)
    : 0;
  const supermoonBonus = calculateSupermoonBonus(lunarApsis, moonIllumination, objectType);

  const totalScore =
    altitudeScore +
    moonInterference +
    peakTiming +
    weatherScore +
    surfaceBrightnessScore +
    magnitudeScore +
    typeSuitability +
    transientBonus +
    seasonalWindow +
    noveltyPopularity +
    oppositionBonus +
    elongationBonus +
    supermoonBonus;

  const scoreBreakdown: ScoreBreakdown = {
    altitudeScore,
    moonInterference,
    peakTiming,
    weatherScore,
    surfaceBrightness: surfaceBrightnessScore,
    magnitudeScore,
    typeSuitability,
    transientBonus,
    seasonalWindow,
    noveltyPopularity,
    oppositionBonus,
    elongationBonus,
    supermoonBonus,
  };

  // Generate reason string
  const reasons: string[] = [];
  if (altitudeScore >= 30) reasons.push('High altitude');
  if (moonInterference >= 24) reasons.push('Low moon interference');
  if (weatherScore >= 12) reasons.push('Good weather');
  if (transientBonus > 0) reasons.push('Rare/transient');
  if (seasonalWindow >= 12) reasons.push('In season');
  if (oppositionBonus >= 15) reasons.push('At opposition');
  if (elongationBonus >= 10) reasons.push('Near max elongation');
  if (supermoonBonus >= 5) reasons.push('Supermoon');

  return {
    objectName,
    category: objectType,
    subtype,
    totalScore: Math.round(totalScore),
    scoreBreakdown,
    reason: reasons.join(', ') || 'Visible tonight',
    visibility,
    magnitude,
  };
}

/**
 * Get score tier from total score
 */
export function getScoreTier(totalScore: number): ScoreTier {
  if (totalScore >= 150) return 'excellent';
  if (totalScore >= 100) return 'very_good';
  if (totalScore >= 75) return 'good';
  if (totalScore >= 40) return 'fair';
  return 'poor';
}

/**
 * Get tier display info
 */
export function getTierDisplay(tier: ScoreTier): { stars: number; label: string; color: string } {
  switch (tier) {
    case 'excellent': return { stars: 5, label: 'Excellent', color: 'text-yellow-400' };
    case 'very_good': return { stars: 4, label: 'Very Good', color: 'text-green-400' };
    case 'good': return { stars: 3, label: 'Good', color: 'text-blue-400' };
    case 'fair': return { stars: 2, label: 'Fair', color: 'text-orange-400' };
    case 'poor': return { stars: 1, label: 'Poor', color: 'text-red-400' };
  }
}
