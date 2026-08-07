import { CACHE_KEYS } from '@/lib/utils/cache';
import type {
  HorizonProfile,
  HorizonSectorLabel,
  Location,
  NightWeather,
  ObjectVisibility,
} from '@/types';

export interface TargetAccessWindow {
  start: Date;
  end: Date;
  durationMinutes: number;
  bestTimeOverlapMinutes: number;
}

export interface TargetAccessibility {
  isAccessible: boolean;
  windows: TargetAccessWindow[];
  bestWindow: TargetAccessWindow | null;
  accessibleMinutes: number;
  bestWindowOverlapMinutes: number;
  priorityScore: number;
}

/** A time-ordered altitude/azimuth sample pair for one object. */
export interface AltAzSample {
  timeMs: number;
  altitude: number;
  azimuth: number;
}

/**
 * The minimum altitude the horizon demands over one stretch of time, derived
 * from the sector the object occupies during that stretch.
 */
export interface HorizonThresholdSegment {
  startMs: number;
  endMs: number;
  /** max(whole-sky minimum, sector obstruction). 90 means fully blocked. */
  thresholdDegrees: number;
  /** The sector's own obstruction height, without the whole-sky minimum. */
  sectorThresholdDegrees: number;
  sectorLabel: HorizonSectorLabel;
  isBlocked: boolean;
}

/** A threshold segment plus the object's altitude at each end of it. */
interface ThresholdSpan extends HorizonThresholdSegment {
  startAltitude: number;
  endAltitude: number;
}

interface TimeInterval {
  startMs: number;
  endMs: number;
}

const SECTOR_WIDTH_DEGREES = 45;
const SECTOR_BOUNDARY_OFFSET_DEGREES = SECTOR_WIDTH_DEGREES / 2;
const BLOCKED_ALTITUDE = 90;
const MAXIMUM_GLOBAL_ALTITUDE = 60;
const MERGE_TOLERANCE_MS = 1;

export const HORIZON_ALTITUDE_LEVELS = [0, 15, 30, 45, 90] as const;
export type HorizonAltitudeLevel = (typeof HORIZON_ALTITUDE_LEVELS)[number];

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

function clampAltitude(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(BLOCKED_ALTITUDE, value));
}

function clampGlobalAltitude(value: unknown): number {
  return Math.min(clampAltitude(value), MAXIMUM_GLOBAL_ALTITUDE);
}

function normalizeAzimuth(azimuth: number): number {
  const normalized = azimuth % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getSectorIndexForAzimuth(azimuth: number): number | null {
  if (!Number.isFinite(azimuth)) return null;
  return (
    Math.round(normalizeAzimuth(azimuth) / SECTOR_WIDTH_DEGREES) % HORIZON_SECTOR_CONFIGS.length
  );
}

export function createDefaultHorizonProfile(): HorizonProfile {
  return {
    minimumAltitude: 0,
    sectors: HORIZON_SECTOR_CONFIGS.map(config => ({
      ...config,
      minAltitude: 0,
    })),
  };
}

export function normalizeHorizonProfile(value: unknown): HorizonProfile {
  const defaultProfile = createDefaultHorizonProfile();
  if (!value || typeof value !== 'object') return defaultProfile;

  const candidate = value as Partial<HorizonProfile>;
  const sectorsByLabel = new Map(
    Array.isArray(candidate.sectors)
      ? candidate.sectors
          .filter(sector => sector && typeof sector === 'object')
          .map(sector => [sector.label, sector] as const)
      : []
  );

  return {
    minimumAltitude: clampGlobalAltitude(candidate.minimumAltitude),
    sectors: HORIZON_SECTOR_CONFIGS.map(config => ({
      ...config,
      minAltitude: clampAltitude(sectorsByLabel.get(config.label)?.minAltitude),
    })),
  };
}

export function getHorizonProfileCacheKey(location: Location): string {
  // Horizon obstructions are site-specific. Five decimal places are roughly
  // metre-scale; the old two-decimal key could share a profile across sites
  // more than a kilometre apart.
  return `${CACHE_KEYS.HORIZON_PREFIX}${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
}

export function cycleSectorMinAltitude(current: number): number {
  const index = HORIZON_ALTITUDE_LEVELS.indexOf(
    current as (typeof HORIZON_ALTITUDE_LEVELS)[number]
  );
  const nextIndex = index === -1 ? 0 : (index + 1) % HORIZON_ALTITUDE_LEVELS.length;
  return HORIZON_ALTITUDE_LEVELS[nextIndex];
}

export function getSectorAltitudeLabel(minAltitude: number): string {
  if (minAltitude >= BLOCKED_ALTITUDE) return 'Blocked';
  if (minAltitude <= 0) return 'Open';
  return `${minAltitude}°+`;
}

/**
 * Fill for a sector's block in the horizon silhouette. Blocked gets a hatch so
 * it reads as a wall rather than as very tall trees.
 */
export function getSectorFillClass(minAltitude: number): string {
  if (minAltitude >= BLOCKED_ALTITUDE)
    return 'bg-red-500/35 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.28)_4px,rgba(0,0,0,0.28)_8px)]';
  if (minAltitude >= 45) return 'bg-orange-500/35';
  if (minAltitude >= 30) return 'bg-amber-500/30';
  if (minAltitude >= 15) return 'bg-lime-500/25';
  return '';
}

/** Label colour matching a sector's obstruction height. */
export function getSectorTextClass(minAltitude: number): string {
  if (minAltitude >= BLOCKED_ALTITUDE) return 'text-red-300';
  if (minAltitude >= 45) return 'text-orange-300';
  if (minAltitude >= 30) return 'text-amber-300';
  if (minAltitude >= 15) return 'text-lime-300';
  return 'text-green-300';
}

export function getMinVisibleAltitudeForAzimuth(profile: HorizonProfile, azimuth: number): number {
  const sectorIndex = getSectorIndexForAzimuth(azimuth);
  const minimumAltitude = clampGlobalAltitude(profile.minimumAltitude);
  if (sectorIndex === null) return minimumAltitude;

  const label = HORIZON_SECTOR_CONFIGS[sectorIndex].label;
  const sector = profile.sectors.find(candidate => candidate.label === label);
  return Math.max(minimumAltitude, clampAltitude(sector?.minAltitude));
}

/** The sector an azimuth belongs to, and that sector's own obstruction height. */
function getSectorAtAzimuth(
  profile: HorizonProfile,
  azimuth: number
): { label: HorizonSectorLabel; sectorMinAltitude: number } {
  const sectorIndex = getSectorIndexForAzimuth(azimuth);
  // A non-finite azimuth carries no directional information, so only the
  // whole-sky minimum applies — matching getMinVisibleAltitudeForAzimuth.
  if (sectorIndex === null) return { label: 'N', sectorMinAltitude: 0 };

  const label = HORIZON_SECTOR_CONFIGS[sectorIndex].label;
  const sector = profile.sectors.find(candidate => candidate.label === label);
  return { label, sectorMinAltitude: clampAltitude(sector?.minAltitude) };
}

function pairVisibilitySamples(visibility: ObjectVisibility): AltAzSample[] {
  const azimuthByTime = new Map(
    visibility.azimuthSamples
      .filter(([time, azimuth]) => Number.isFinite(time.getTime()) && Number.isFinite(azimuth))
      .map(([time, azimuth]) => [time.getTime(), azimuth] as const)
  );

  return visibility.altitudeSamples
    .flatMap(([time, altitude]) => {
      const timeMs = time.getTime();
      const azimuth = azimuthByTime.get(timeMs);
      if (!Number.isFinite(timeMs) || !Number.isFinite(altitude) || azimuth === undefined)
        return [];
      return [{ timeMs, altitude, azimuth }];
    })
    .sort((a, b) => a.timeMs - b.timeMs);
}

function getShortestAzimuthDelta(start: number, end: number): number {
  return ((end - start + 540) % 360) - 180;
}

function getSectorBoundaryRatios(startAzimuth: number, endAzimuth: number): number[] {
  const start = normalizeAzimuth(startAzimuth);
  const end = start + getShortestAzimuthDelta(startAzimuth, endAzimuth);
  if (start === end) return [0, 1];

  const low = Math.min(start, end);
  const high = Math.max(start, end);
  const firstBoundaryIndex = Math.ceil(
    (low - SECTOR_BOUNDARY_OFFSET_DEGREES) / SECTOR_WIDTH_DEGREES
  );
  const lastBoundaryIndex = Math.floor(
    (high - SECTOR_BOUNDARY_OFFSET_DEGREES) / SECTOR_WIDTH_DEGREES
  );
  const ratios = [0];

  for (let index = firstBoundaryIndex; index <= lastBoundaryIndex; index++) {
    const boundary = SECTOR_BOUNDARY_OFFSET_DEGREES + index * SECTOR_WIDTH_DEGREES;
    const ratio = (boundary - start) / (end - start);
    if (ratio > 0 && ratio < 1) ratios.push(ratio);
  }

  ratios.push(1);
  return ratios.sort((a, b) => a - b);
}

function appendInterval(intervals: TimeInterval[], startMs: number, endMs: number): void {
  if (endMs <= startMs) return;
  const previous = intervals[intervals.length - 1];

  if (previous && startMs - previous.endMs <= MERGE_TOLERANCE_MS) {
    previous.endMs = Math.max(previous.endMs, endMs);
    return;
  }

  intervals.push({ startMs, endMs });
}

function appendAccessiblePart(
  intervals: TimeInterval[],
  startMs: number,
  endMs: number,
  startClearance: number,
  endClearance: number
): void {
  const startsAccessible = startClearance >= 0;
  const endsAccessible = endClearance >= 0;

  if (startsAccessible && endsAccessible) {
    appendInterval(intervals, startMs, endMs);
    return;
  }
  if (!startsAccessible && !endsAccessible) return;

  const crossingRatio = Math.max(0, Math.min(1, -startClearance / (endClearance - startClearance)));
  const crossingMs = startMs + (endMs - startMs) * crossingRatio;

  if (startsAccessible) {
    appendInterval(intervals, startMs, crossingMs);
  } else {
    appendInterval(intervals, crossingMs, endMs);
  }
}

/**
 * Split each consecutive sample pair at every 45° sector boundary it crosses,
 * so every resulting span sits in exactly one sector and therefore has one
 * constant altitude threshold. Both the accessible-window maths and the chart's
 * step line are built from this, so the two can never disagree.
 */
function buildThresholdSpans(
  samples: readonly AltAzSample[],
  horizonProfile: HorizonProfile
): ThresholdSpan[] {
  const spans: ThresholdSpan[] = [];
  const minimumAltitude = clampGlobalAltitude(horizonProfile.minimumAltitude);

  for (let sampleIndex = 0; sampleIndex < samples.length - 1; sampleIndex++) {
    const start = samples[sampleIndex];
    const end = samples[sampleIndex + 1];
    if (end.timeMs <= start.timeMs) continue;

    const azimuthDelta = getShortestAzimuthDelta(start.azimuth, end.azimuth);
    const boundaryRatios = getSectorBoundaryRatios(start.azimuth, end.azimuth);

    for (let ratioIndex = 0; ratioIndex < boundaryRatios.length - 1; ratioIndex++) {
      const startRatio = boundaryRatios[ratioIndex];
      const endRatio = boundaryRatios[ratioIndex + 1];
      const midpointRatio = (startRatio + endRatio) / 2;
      const { label, sectorMinAltitude } = getSectorAtAzimuth(
        horizonProfile,
        start.azimuth + azimuthDelta * midpointRatio
      );
      const thresholdDegrees = Math.max(minimumAltitude, sectorMinAltitude);

      spans.push({
        startMs: start.timeMs + (end.timeMs - start.timeMs) * startRatio,
        endMs: start.timeMs + (end.timeMs - start.timeMs) * endRatio,
        thresholdDegrees,
        sectorThresholdDegrees: sectorMinAltitude,
        sectorLabel: label,
        isBlocked: thresholdDegrees >= BLOCKED_ALTITUDE,
        startAltitude: start.altitude + (end.altitude - start.altitude) * startRatio,
        endAltitude: start.altitude + (end.altitude - start.altitude) * endRatio,
      });
    }
  }

  return spans;
}

/**
 * Render-ready step segments: adjacent spans sharing a sector and threshold are
 * merged. Do not feed these back into the window maths — a merged segment can
 * hide a dip below and back above the threshold.
 */
export function getHorizonThresholdSegments(
  samples: readonly AltAzSample[],
  horizonProfile: HorizonProfile
): HorizonThresholdSegment[] {
  const segments: HorizonThresholdSegment[] = [];

  for (const span of buildThresholdSpans(samples, normalizeHorizonProfile(horizonProfile))) {
    const previous = segments[segments.length - 1];

    if (
      previous &&
      previous.sectorLabel === span.sectorLabel &&
      previous.thresholdDegrees === span.thresholdDegrees &&
      span.startMs - previous.endMs <= MERGE_TOLERANCE_MS
    ) {
      previous.endMs = Math.max(previous.endMs, span.endMs);
      continue;
    }

    segments.push({
      startMs: span.startMs,
      endMs: span.endMs,
      thresholdDegrees: span.thresholdDegrees,
      sectorThresholdDegrees: span.sectorThresholdDegrees,
      sectorLabel: span.sectorLabel,
      isBlocked: span.isBlocked,
    });
  }

  return segments;
}

function calculateAccessibleIntervals(
  samples: readonly AltAzSample[],
  horizonProfile: HorizonProfile
): TimeInterval[] {
  const intervals: TimeInterval[] = [];

  for (const span of buildThresholdSpans(samples, horizonProfile)) {
    if (span.isBlocked) continue;
    appendAccessiblePart(
      intervals,
      span.startMs,
      span.endMs,
      span.startAltitude - span.thresholdDegrees,
      span.endAltitude - span.thresholdDegrees
    );
  }

  return intervals;
}

function getOverlapMinutes(
  interval: TimeInterval,
  range: { start: Date; end: Date } | null
): number {
  if (!range) return 0;
  const overlapMs =
    Math.min(interval.endMs, range.end.getTime()) -
    Math.max(interval.startMs, range.start.getTime());
  return Math.max(0, overlapMs / (60 * 1000));
}

function selectBestWindow(windows: TargetAccessWindow[]): TargetAccessWindow | null {
  let bestWindow: TargetAccessWindow | null = null;

  for (const window of windows) {
    if (
      bestWindow === null ||
      window.bestTimeOverlapMinutes > bestWindow.bestTimeOverlapMinutes ||
      (window.bestTimeOverlapMinutes === bestWindow.bestTimeOverlapMinutes &&
        window.durationMinutes > bestWindow.durationMinutes)
    ) {
      bestWindow = window;
    }
  }

  return bestWindow;
}

export function evaluateTargetAccessibility(
  visibility: ObjectVisibility,
  horizonProfile: HorizonProfile,
  weather: NightWeather | null
): TargetAccessibility {
  const intervals = calculateAccessibleIntervals(
    pairVisibilitySamples(visibility),
    normalizeHorizonProfile(horizonProfile)
  );
  const bestTime = weather?.bestTime ?? null;
  const windows = intervals.map(interval => ({
    start: new Date(interval.startMs),
    end: new Date(interval.endMs),
    durationMinutes: (interval.endMs - interval.startMs) / (60 * 1000),
    bestTimeOverlapMinutes: getOverlapMinutes(interval, bestTime),
  }));
  const accessibleMinutes = windows.reduce((total, window) => total + window.durationMinutes, 0);
  const bestWindowOverlapMinutes = windows.reduce(
    (total, window) => total + window.bestTimeOverlapMinutes,
    0
  );

  return {
    isAccessible: windows.length > 0,
    windows,
    bestWindow: selectBestWindow(windows),
    accessibleMinutes,
    bestWindowOverlapMinutes,
    priorityScore: bestWindowOverlapMinutes * 3 + accessibleMinutes,
  };
}
