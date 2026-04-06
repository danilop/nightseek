import { CACHE_KEYS } from '@/lib/utils/cache';
import type {
  HorizonProfile,
  HorizonSector,
  HorizonSectorLabel,
  Location,
  NightWeather,
  ObjectVisibility,
} from '@/types';

export interface TargetAccessibility {
  isAccessible: boolean;
  accessibleMinutes: number;
  bestWindowOverlapMinutes: number;
  priorityScore: number;
}

const SAMPLE_INTERVAL_FALLBACK_MINUTES = 10;

export const HORIZON_ALTITUDE_LEVELS = [0, 15, 30, 45, 90] as const;

export const HORIZON_SECTOR_CONFIGS: ReadonlyArray<{
  label: HorizonSectorLabel;
  centerAzimuth: number;
}> = [
  { label: 'N', centerAzimuth: 0 },
  { label: 'NE', centerAzimuth: 45 },
  { label: 'E', centerAzimuth: 90 },
  { label: 'SE', centerAzimuth: 135 },
  { label: 'S', centerAzimuth: 180 },
  { label: 'SW', centerAzimuth: 225 },
  { label: 'W', centerAzimuth: 270 },
  { label: 'NW', centerAzimuth: 315 },
];

function normalizeAzimuth(azimuth: number): number {
  const normalized = azimuth % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function createDefaultHorizonProfile(): HorizonProfile {
  return {
    sectors: HORIZON_SECTOR_CONFIGS.map(config => ({
      ...config,
      minAltitude: 0,
    })),
  };
}

export function getHorizonProfileCacheKey(location: Location): string {
  return `${CACHE_KEYS.HORIZON_PREFIX}${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
}

export function cycleSectorMinAltitude(current: number): number {
  const index = HORIZON_ALTITUDE_LEVELS.indexOf(
    current as (typeof HORIZON_ALTITUDE_LEVELS)[number]
  );
  const nextIndex = index === -1 ? 0 : (index + 1) % HORIZON_ALTITUDE_LEVELS.length;
  return HORIZON_ALTITUDE_LEVELS[nextIndex];
}

export function getSectorAltitudeLabel(minAltitude: number): string {
  if (minAltitude >= 90) return 'Blocked';
  if (minAltitude <= 0) return 'Open';
  return `${minAltitude}°+`;
}

export function getSectorToneClass(minAltitude: number): string {
  if (minAltitude >= 90) return 'border-red-500/30 bg-red-500/15 text-red-300';
  if (minAltitude >= 45) return 'border-orange-500/30 bg-orange-500/15 text-orange-300';
  if (minAltitude >= 30) return 'border-amber-500/30 bg-amber-500/15 text-amber-300';
  if (minAltitude >= 15) return 'border-lime-500/30 bg-lime-500/15 text-lime-300';
  return 'border-green-500/30 bg-green-500/15 text-green-300';
}

function getSectorForAzimuth(profile: HorizonProfile, azimuth: number): HorizonSector {
  const sectorIndex = Math.round(normalizeAzimuth(azimuth) / 45) % HORIZON_SECTOR_CONFIGS.length;
  return profile.sectors[sectorIndex] ?? createDefaultHorizonProfile().sectors[sectorIndex];
}

export function getMinVisibleAltitudeForAzimuth(profile: HorizonProfile, azimuth: number): number {
  return getSectorForAzimuth(profile, azimuth).minAltitude;
}

function getSampleIntervalMinutes(samples: [Date, number][]): number {
  if (samples.length < 2) return SAMPLE_INTERVAL_FALLBACK_MINUTES;
  const intervalMinutes = (samples[1][0].getTime() - samples[0][0].getTime()) / (1000 * 60);
  return intervalMinutes > 0 ? intervalMinutes : SAMPLE_INTERVAL_FALLBACK_MINUTES;
}

export function evaluateTargetAccessibility(
  visibility: ObjectVisibility,
  horizonProfile: HorizonProfile,
  weather: NightWeather | null
): TargetAccessibility {
  const sampleCount = Math.min(visibility.altitudeSamples.length, visibility.azimuthSamples.length);
  if (sampleCount === 0) {
    return {
      isAccessible: false,
      accessibleMinutes: 0,
      bestWindowOverlapMinutes: 0,
      priorityScore: 0,
    };
  }

  const intervalMinutes = getSampleIntervalMinutes(visibility.altitudeSamples);
  let accessibleSamples = 0;
  let bestWindowOverlapSamples = 0;

  for (let i = 0; i < sampleCount; i++) {
    const [time, altitude] = visibility.altitudeSamples[i];
    const [, azimuth] = visibility.azimuthSamples[i];
    const minAltitude = getMinVisibleAltitudeForAzimuth(horizonProfile, azimuth);
    const isAccessible = altitude >= minAltitude;

    if (!isAccessible) continue;

    accessibleSamples += 1;

    if (
      weather?.bestTime &&
      time.getTime() >= weather.bestTime.start.getTime() &&
      time.getTime() <= weather.bestTime.end.getTime()
    ) {
      bestWindowOverlapSamples += 1;
    }
  }

  const accessibleMinutes = accessibleSamples * intervalMinutes;
  const bestWindowOverlapMinutes = bestWindowOverlapSamples * intervalMinutes;

  return {
    isAccessible: accessibleMinutes > 0,
    accessibleMinutes,
    bestWindowOverlapMinutes,
    priorityScore: bestWindowOverlapMinutes * 3 + accessibleMinutes,
  };
}
