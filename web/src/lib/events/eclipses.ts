import * as Astronomy from 'astronomy-engine';
import type { LunarEclipse, SolarEclipse } from '@/types';

/**
 * Search for the next lunar eclipse after a given date
 */
function searchNextLunarEclipse(startDate: Date): {
  kind: 'penumbral' | 'partial' | 'total';
  peakTime: Date;
  magnitude: number;
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
      magnitude: number;
      penumbralStart?: Date;
      partialStart?: Date;
      totalStart?: Date;
      totalEnd?: Date;
      partialEnd?: Date;
      penumbralEnd?: Date;
    } = {
      kind,
      peakTime: eclipse.peak.date,
      magnitude: eclipse.sd_penum, // semi-duration gives us a measure
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

    return {
      kind,
      peakTime: eclipse.peak.time.date,
      obscuration: eclipse.obscuration,
      altitude: eclipse.peak.altitude,
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
  const visibility = eclipse.isVisible
    ? 'visible from your location'
    : 'not visible from your location';

  return `${kindStr} lunar eclipse - ${visibility}`;
}

/**
 * Get human-readable description of solar eclipse
 */
export function describeSolarEclipse(eclipse: SolarEclipse): string {
  const kindStr = eclipse.kind.charAt(0).toUpperCase() + eclipse.kind.slice(1);
  const obscuration = (eclipse.obscuration * 100).toFixed(0);

  return `${kindStr} solar eclipse - ${obscuration}% of Sun obscured`;
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
        lunar = {
          kind: lunarResult.kind,
          peakTime: lunarResult.peakTime,
          magnitude: lunarResult.magnitude,
          isVisible: true, // Simplified - would need night check
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
