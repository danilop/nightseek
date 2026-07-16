import * as Astronomy from 'astronomy-engine';
import type { LunarEclipse, SolarEclipse } from '@/types';
import { angularSeparation } from '../astronomy/calculator';
import { AU_TO_KM } from '../astronomy/constants';

const SUN_RADIUS_KM = 695_700;
const MOON_POLAR_RADIUS_KM = 1_736;
const VISIBILITY_SAMPLE_MS = 60_000;

interface VisibilityWindow {
  start: Date;
  end: Date;
  maxAltitude: number;
}

function getBodyAltitude(body: Astronomy.Body, time: Date, observer: Astronomy.Observer): number {
  const equator = Astronomy.Equator(body, time, observer, true, true);
  return Astronomy.Horizon(time, observer, equator.ra, equator.dec, 'normal').altitude;
}

function interpolateHorizonCrossing(
  start: Date,
  startAltitude: number,
  end: Date,
  endAltitude: number
): Date {
  const denominator = endAltitude - startAltitude;
  if (Math.abs(denominator) < Number.EPSILON) return start;
  const ratio = Math.max(0, Math.min(1, -startAltitude / denominator));
  return new Date(start.getTime() + (end.getTime() - start.getTime()) * ratio);
}

/** Find the portion of an event for which the body center is above the apparent horizon. */
function getVisibilityWindow(
  body: Astronomy.Body,
  observer: Astronomy.Observer,
  start: Date,
  end: Date
): VisibilityWindow | null {
  if (end <= start) return null;

  let previousTime = start;
  let previousAltitude = getBodyAltitude(body, previousTime, observer);
  let visibleStart: Date | null = previousAltitude > 0 ? start : null;
  let visibleEnd: Date | null = null;
  let maxAltitude = previousAltitude;

  for (
    let timeMs = Math.min(start.getTime() + VISIBILITY_SAMPLE_MS, end.getTime());
    timeMs <= end.getTime();
    timeMs = Math.min(timeMs + VISIBILITY_SAMPLE_MS, end.getTime())
  ) {
    const time = new Date(timeMs);
    const altitude = getBodyAltitude(body, time, observer);
    maxAltitude = Math.max(maxAltitude, altitude);

    if (previousAltitude <= 0 && altitude > 0) {
      visibleStart ??= interpolateHorizonCrossing(previousTime, previousAltitude, time, altitude);
    } else if (previousAltitude > 0 && altitude <= 0) {
      visibleEnd = interpolateHorizonCrossing(previousTime, previousAltitude, time, altitude);
    }

    previousTime = time;
    previousAltitude = altitude;
    if (timeMs === end.getTime()) break;
  }

  if (previousAltitude > 0) visibleEnd = end;
  if (!visibleStart || !visibleEnd || visibleEnd <= visibleStart || maxAltitude <= 0) return null;
  return { start: visibleStart, end: visibleEnd, maxAltitude };
}

function intervalsOverlap(
  startA: Date | undefined,
  endA: Date | undefined,
  startB: Date,
  endB: Date
): boolean {
  return !!startA && !!endA && startA < endB && endA > startB;
}

function discObscuration(radiusA: number, radiusB: number, separation: number): number {
  if (separation >= radiusA + radiusB) return 0;
  if (separation <= Math.abs(radiusA - radiusB)) {
    return radiusB >= radiusA ? 1 : (radiusB * radiusB) / (radiusA * radiusA);
  }

  const x = (radiusA * radiusA - radiusB * radiusB + separation * separation) / (2 * separation);
  const y = Math.sqrt(Math.max(0, radiusA * radiusA - x * x));
  const lensA = radiusA * radiusA * Math.acos(x / radiusA) - x * y;
  const lensB = radiusB * radiusB * Math.acos((separation - x) / radiusB) - (separation - x) * y;
  return Math.max(0, Math.min(1, (lensA + lensB) / (Math.PI * radiusA * radiusA)));
}

/** Fraction of the apparent solar disc covered at a specific local instant. */
function getSolarObscurationAtTime(time: Date, observer: Astronomy.Observer): number {
  const sun = Astronomy.Equator(Astronomy.Body.Sun, time, observer, false, true);
  const moon = Astronomy.Equator(Astronomy.Body.Moon, time, observer, false, true);
  const sunRadius = Math.asin(SUN_RADIUS_KM / (sun.dist * AU_TO_KM));
  const moonRadius = Math.asin(MOON_POLAR_RADIUS_KM / (moon.dist * AU_TO_KM));
  const separation =
    angularSeparation(sun.ra * 15, sun.dec, moon.ra * 15, moon.dec) * (Math.PI / 180);
  return discObscuration(sunRadius, moonRadius, separation);
}

/**
 * Search for the next lunar eclipse after a given date
 */
function searchNextLunarEclipse(startDate: Date): {
  kind: 'penumbral' | 'partial' | 'total';
  peakTime: Date;
  obscuration: number;
  penumbralStart?: Date;
  partialStart?: Date;
  totalStart?: Date;
  totalEnd?: Date;
  partialEnd?: Date;
  penumbralEnd?: Date;
} | null {
  try {
    const eclipse = Astronomy.SearchLunarEclipse(startDate);
    if (!eclipse) return null;

    // Map the eclipse kind
    let kind: 'penumbral' | 'partial' | 'total';
    switch (eclipse.kind) {
      case Astronomy.EclipseKind.Penumbral:
        kind = 'penumbral';
        break;
      case Astronomy.EclipseKind.Partial:
        kind = 'partial';
        break;
      case Astronomy.EclipseKind.Total:
        kind = 'total';
        break;
      default:
        return null;
    }

    const result: {
      kind: 'penumbral' | 'partial' | 'total';
      peakTime: Date;
      obscuration: number;
      penumbralStart?: Date;
      partialStart?: Date;
      totalStart?: Date;
      totalEnd?: Date;
      partialEnd?: Date;
      penumbralEnd?: Date;
    } = {
      kind,
      peakTime: eclipse.peak.date,
      obscuration: eclipse.obscuration,
    };

    // Add timing information if available
    if (eclipse.sd_penum > 0) {
      result.penumbralStart = new Date(eclipse.peak.date.getTime() - eclipse.sd_penum * 60000);
      result.penumbralEnd = new Date(eclipse.peak.date.getTime() + eclipse.sd_penum * 60000);
    }

    if (eclipse.sd_partial > 0) {
      result.partialStart = new Date(eclipse.peak.date.getTime() - eclipse.sd_partial * 60000);
      result.partialEnd = new Date(eclipse.peak.date.getTime() + eclipse.sd_partial * 60000);
    }

    if (eclipse.sd_total > 0) {
      result.totalStart = new Date(eclipse.peak.date.getTime() - eclipse.sd_total * 60000);
      result.totalEnd = new Date(eclipse.peak.date.getTime() + eclipse.sd_total * 60000);
    }

    return result;
  } catch (_error) {
    return null;
  }
}

function getLunarVisibility(
  eclipse: NonNullable<ReturnType<typeof searchNextLunarEclipse>>,
  observer: Astronomy.Observer
): {
  window: VisibilityWindow | null;
  altitudeAtPeak: number;
  visibleKind: LunarEclipse['visibleKind'];
} {
  const start = eclipse.penumbralStart ?? eclipse.peakTime;
  const end = eclipse.penumbralEnd ?? eclipse.peakTime;
  const window = getVisibilityWindow(Astronomy.Body.Moon, observer, start, end);
  const altitudeAtPeak = getBodyAltitude(Astronomy.Body.Moon, eclipse.peakTime, observer);
  let visibleKind: LunarEclipse['visibleKind'] = null;

  if (window) {
    visibleKind = 'penumbral';
    if (intervalsOverlap(eclipse.partialStart, eclipse.partialEnd, window.start, window.end)) {
      visibleKind = 'partial';
    }
    if (intervalsOverlap(eclipse.totalStart, eclipse.totalEnd, window.start, window.end)) {
      visibleKind = 'total';
    }
  }

  return { window, altitudeAtPeak, visibleKind };
}

/**
 * Search for the next solar eclipse visible from a location
 */
function searchNextSolarEclipse(
  startDate: Date,
  observer: Astronomy.Observer
): {
  kind: 'partial' | 'annular' | 'total';
  peakTime: Date;
  obscuration: number;
  altitude: number;
  geometricPeakTime: Date;
  geometricPeakAltitude: number;
  partialStart: Date;
  centralStart?: Date;
  centralEnd?: Date;
  partialEnd: Date;
  visibleStart: Date;
  visibleEnd: Date;
} | null {
  try {
    const eclipse = Astronomy.SearchLocalSolarEclipse(startDate, observer);
    if (!eclipse) return null;

    // Determine eclipse kind based on local visibility
    let kind: 'partial' | 'annular' | 'total';
    switch (eclipse.kind) {
      case Astronomy.EclipseKind.Partial:
        kind = 'partial';
        break;
      case Astronomy.EclipseKind.Annular:
        kind = 'annular';
        break;
      case Astronomy.EclipseKind.Total:
        kind = 'total';
        break;
      default:
        return null;
    }

    const partialStart = eclipse.partial_begin.time.date;
    const partialEnd = eclipse.partial_end.time.date;
    const visibleWindow = getVisibilityWindow(
      Astronomy.Body.Sun,
      observer,
      partialStart,
      partialEnd
    );
    if (!visibleWindow) return null;

    const geometricPeakTime = eclipse.peak.time.date;
    const visibleDurationMs = visibleWindow.end.getTime() - visibleWindow.start.getTime();
    const horizonInsetMs = Math.min(1_000, visibleDurationMs / 2);
    const visiblePeakMs = Math.max(
      visibleWindow.start.getTime() + horizonInsetMs,
      Math.min(geometricPeakTime.getTime(), visibleWindow.end.getTime() - horizonInsetMs)
    );
    const peakTime = new Date(visiblePeakMs);
    const centralStart = eclipse.total_begin?.time.date;
    const centralEnd = eclipse.total_end?.time.date;
    const centralPhaseVisible = intervalsOverlap(
      centralStart,
      centralEnd,
      visibleWindow.start,
      visibleWindow.end
    );
    if (!centralPhaseVisible) kind = 'partial';

    return {
      kind,
      peakTime,
      obscuration: getSolarObscurationAtTime(peakTime, observer),
      altitude: getBodyAltitude(Astronomy.Body.Sun, peakTime, observer),
      geometricPeakTime,
      geometricPeakAltitude: eclipse.peak.altitude,
      partialStart,
      centralStart,
      centralEnd,
      partialEnd,
      visibleStart: visibleWindow.start,
      visibleEnd: visibleWindow.end,
    };
  } catch (_error) {
    return null;
  }
}

/**
 * Get human-readable description of lunar eclipse
 */
export function describeLunarEclipse(eclipse: LunarEclipse): string {
  const kindStr = eclipse.kind.charAt(0).toUpperCase() + eclipse.kind.slice(1);
  if (!eclipse.isVisible || !eclipse.visibleKind) {
    return `${kindStr} lunar eclipse - below your horizon`;
  }

  if (eclipse.visibleKind !== eclipse.kind) {
    return `${kindStr} lunar eclipse - ${eclipse.visibleKind} phase visible locally`;
  }

  return `${kindStr} lunar eclipse - visible from your location`;
}

/**
 * Get human-readable description of solar eclipse
 */
export function describeSolarEclipse(eclipse: SolarEclipse): string {
  const kindStr = eclipse.kind.charAt(0).toUpperCase() + eclipse.kind.slice(1);
  const obscuration = (eclipse.obscuration * 100).toFixed(0);

  return `${kindStr} solar eclipse - ${obscuration}% maximum visible coverage`;
}

/**
 * Check for any eclipses within a forecast window
 */
export function detectEclipses(
  date: Date,
  observer: Astronomy.Observer,
  forecastDays: number = 7
): { lunar: LunarEclipse | null; solar: SolarEclipse | null } {
  let lunar: LunarEclipse | null = null;
  let solar: SolarEclipse | null = null;

  try {
    // Search for lunar eclipse
    const lunarResult = searchNextLunarEclipse(date);
    if (lunarResult) {
      const daysDiff = (lunarResult.peakTime.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 0 && daysDiff <= forecastDays) {
        const lunarVisibility = getLunarVisibility(lunarResult, observer);
        lunar = {
          kind: lunarResult.kind,
          visibleKind: lunarVisibility.visibleKind,
          peakTime: lunarResult.peakTime,
          obscuration: lunarResult.obscuration,
          isVisible: lunarVisibility.window !== null,
          maxAltitude: lunarVisibility.window?.maxAltitude ?? lunarVisibility.altitudeAtPeak,
          altitudeAtPeak: lunarVisibility.altitudeAtPeak,
          visibleStart: lunarVisibility.window?.start,
          visibleEnd: lunarVisibility.window?.end,
          penumbralStart: lunarResult.penumbralStart,
          partialStart: lunarResult.partialStart,
          totalStart: lunarResult.totalStart,
          totalEnd: lunarResult.totalEnd,
          partialEnd: lunarResult.partialEnd,
          penumbralEnd: lunarResult.penumbralEnd,
        };
      }
    }

    // Search for solar eclipse
    const solarResult = searchNextSolarEclipse(date, observer);
    if (solarResult) {
      const daysDiff = (solarResult.peakTime.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff >= 0 && daysDiff <= forecastDays && solarResult.obscuration >= 0.01) {
        solar = solarResult;
      }
    }
  } catch {
    // Silently fail for eclipse detection
  }

  return { lunar, solar };
}
