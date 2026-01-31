import * as Astronomy from 'astronomy-engine';
import type { LunarEclipse, NightInfo, SolarEclipse } from '@/types';

/**
 * Search for the next lunar eclipse after a given date
 */
export function searchNextLunarEclipse(startDate: Date): {
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
export function searchNextSolarEclipse(
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
 * Check if a lunar eclipse is visible during a given night
 */
export function getLunarEclipseForNight(nightInfo: NightInfo): LunarEclipse | null {
  try {
    // Search starting from a few days before the night
    const searchStart = new Date(nightInfo.date);
    searchStart.setDate(searchStart.getDate() - 3);

    const eclipse = searchNextLunarEclipse(searchStart);
    if (!eclipse) return null;

    // Check if eclipse peak falls during this night
    const peakTime = eclipse.peakTime.getTime();
    const nightStart = nightInfo.astronomicalDusk.getTime();
    const nightEnd = nightInfo.astronomicalDawn.getTime();

    // Eclipse is relevant if peak is within +/- 1 day of our night
    // (lunar eclipses can be partially visible over hours)
    const dayMs = 24 * 60 * 60 * 1000;
    if (Math.abs(peakTime - nightStart) > dayMs) {
      return null;
    }

    // Check if Moon is above horizon during eclipse
    // (simplified check - eclipse is "visible" if night includes eclipse time)
    const isVisible = peakTime >= nightStart && peakTime <= nightEnd;

    return {
      kind: eclipse.kind,
      peakTime: eclipse.peakTime,
      magnitude: eclipse.magnitude,
      isVisible,
      penumbralStart: eclipse.penumbralStart,
      partialStart: eclipse.partialStart,
      totalStart: eclipse.totalStart,
      totalEnd: eclipse.totalEnd,
      partialEnd: eclipse.partialEnd,
      penumbralEnd: eclipse.penumbralEnd,
    };
  } catch (_error) {
    return null;
  }
}

/**
 * Check if a solar eclipse is visible on a given date from a location
 * Note: Solar eclipses occur during daytime
 */
export function getSolarEclipseForDate(
  date: Date,
  observer: Astronomy.Observer
): SolarEclipse | null {
  try {
    // Search starting from a few days before
    const searchStart = new Date(date);
    searchStart.setDate(searchStart.getDate() - 3);

    const eclipse = searchNextSolarEclipse(searchStart, observer);
    if (!eclipse) return null;

    // Check if eclipse is within 1 day of our date
    const daysDiff = Math.abs(
      (eclipse.peakTime.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff > 1) {
      return null;
    }

    // Solar eclipse must have significant obscuration to be notable
    if (eclipse.obscuration < 0.01) {
      return null;
    }

    return {
      kind: eclipse.kind,
      peakTime: eclipse.peakTime,
      obscuration: eclipse.obscuration,
      altitude: eclipse.altitude,
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
  } catch (_error) {}

  return { lunar, solar };
}
