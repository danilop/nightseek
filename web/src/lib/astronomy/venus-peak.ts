import * as Astronomy from 'astronomy-engine';
import type { VenusPeakInfo } from '@/types';

/**
 * Days within which Venus is considered "near" peak brightness
 */
const VENUS_PEAK_WINDOW_DAYS = 14;

/**
 * Search for the previous Venus peak magnitude before a date
 */
function searchPreviousVenusPeak(date: Date): Astronomy.IlluminationInfo | null {
  // Search from 60 days before (Venus peaks occur roughly every 584 days)
  const searchStart = new Date(date);
  searchStart.setDate(searchStart.getDate() - 60);

  try {
    let lastPeak: Astronomy.IlluminationInfo | null = null;
    let peak = Astronomy.SearchPeakMagnitude(Astronomy.Body.Venus, searchStart);

    while (peak && peak.time.date.getTime() < date.getTime()) {
      lastPeak = peak;
      // Search for next peak starting after current one
      const nextSearchStart = new Date(peak.time.date);
      nextSearchStart.setDate(nextSearchStart.getDate() + 30);
      peak = Astronomy.SearchPeakMagnitude(Astronomy.Body.Venus, nextSearchStart);
    }

    return lastPeak;
  } catch (_error) {
    return null;
  }
}

/**
 * Search for the next Venus peak magnitude after a date
 */
function searchNextVenusPeak(date: Date): Astronomy.IlluminationInfo | null {
  try {
    return Astronomy.SearchPeakMagnitude(Astronomy.Body.Venus, date);
  } catch (_error) {
    return null;
  }
}

/**
 * Get information about Venus peak brightness
 *
 * Venus reaches peak brightness (around magnitude -4.6 to -4.9) twice
 * during each synodic period - once as an evening star and once as
 * a morning star.
 */
export function getVenusPeakInfo(date: Date): VenusPeakInfo | null {
  const previousPeak = searchPreviousVenusPeak(date);
  const nextPeak = searchNextVenusPeak(date);

  // Check which peak is closer
  let nearestPeak: Astronomy.IlluminationInfo | null = null;
  let daysUntil = Infinity;

  if (previousPeak) {
    const daysSince = (date.getTime() - previousPeak.time.date.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSince <= VENUS_PEAK_WINDOW_DAYS) {
      nearestPeak = previousPeak;
      daysUntil = -Math.round(daysSince); // negative = days since
    }
  }

  if (nextPeak) {
    const daysToNext = (nextPeak.time.date.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);
    if (daysToNext <= VENUS_PEAK_WINDOW_DAYS && daysToNext < Math.abs(daysUntil)) {
      nearestPeak = nextPeak;
      daysUntil = Math.round(daysToNext);
    }
  }

  if (nearestPeak) {
    return {
      peakDate: nearestPeak.time.date,
      peakMagnitude: nearestPeak.mag,
      daysUntil: Math.abs(daysUntil),
      isNearPeak: true,
    };
  }

  // Return info about next peak even if not near
  if (nextPeak) {
    const daysToNext = Math.round(
      (nextPeak.time.date.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)
    );
    return {
      peakDate: nextPeak.time.date,
      peakMagnitude: nextPeak.mag,
      daysUntil: daysToNext,
      isNearPeak: false,
    };
  }

  return null;
}

/**
 * Check if Venus is currently near peak brightness
 */
export function isVenusNearPeak(date: Date): boolean {
  const peakInfo = getVenusPeakInfo(date);
  return peakInfo?.isNearPeak ?? false;
}

/**
 * Get the current magnitude of Venus for comparison
 */
export function getCurrentVenusMagnitude(date: Date): number {
  const illum = Astronomy.Illumination(Astronomy.Body.Venus, date);
  return illum.mag;
}

/**
 * Get descriptive text for Venus peak brightness
 */
export function getVenusPeakDescription(peakInfo: VenusPeakInfo): string {
  const magStr = peakInfo.peakMagnitude.toFixed(1);

  if (peakInfo.isNearPeak) {
    if (peakInfo.daysUntil === 0) {
      return `Venus at peak brightness (${magStr} mag) today!`;
    } else if (peakInfo.daysUntil <= 7) {
      return `Venus near peak brightness (${magStr} mag)`;
    } else {
      return `Venus approaching peak brightness`;
    }
  }

  if (peakInfo.daysUntil <= 30) {
    return `Venus peak in ${peakInfo.daysUntil} days`;
  }

  return '';
}

/**
 * Get upcoming Venus peak brightness events
 */
export function getUpcomingVenusPeaks(startDate: Date, count: number = 2): VenusPeakInfo[] {
  const peaks: VenusPeakInfo[] = [];
  let searchDate = new Date(startDate);

  for (let i = 0; i < count; i++) {
    const peak = searchNextVenusPeak(searchDate);
    if (!peak) break;

    const daysUntil = Math.round(
      (peak.time.date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)
    );

    peaks.push({
      peakDate: peak.time.date,
      peakMagnitude: peak.mag,
      daysUntil,
      isNearPeak: daysUntil <= VENUS_PEAK_WINDOW_DAYS,
    });

    // Move search date past this peak
    searchDate = new Date(peak.time.date);
    searchDate.setDate(searchDate.getDate() + 30);
  }

  return peaks;
}
