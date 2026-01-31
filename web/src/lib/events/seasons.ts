import * as Astronomy from 'astronomy-engine';
import type { SeasonalMarker } from '@/types';

type SeasonType = 'march_equinox' | 'june_solstice' | 'september_equinox' | 'december_solstice';

/**
 * Get all seasonal events for a given year
 */
export function getSeasonsForYear(year: number): {
  marchEquinox: Date;
  juneSolstice: Date;
  septemberEquinox: Date;
  decemberSolstice: Date;
} {
  try {
    const seasons = Astronomy.Seasons(year);

    return {
      marchEquinox: seasons.mar_equinox.date,
      juneSolstice: seasons.jun_solstice.date,
      septemberEquinox: seasons.sep_equinox.date,
      decemberSolstice: seasons.dec_solstice.date,
    };
  } catch (_error) {
    // Return approximate dates as fallback
    return {
      marchEquinox: new Date(year, 2, 20),
      juneSolstice: new Date(year, 5, 21),
      septemberEquinox: new Date(year, 8, 22),
      decemberSolstice: new Date(year, 11, 21),
    };
  }
}

/**
 * Find the next seasonal marker from a given date
 */
export function getNextSeasonalMarker(date: Date, windowDays: number = 7): SeasonalMarker | null {
  try {
    const year = date.getFullYear();

    // Get seasons for current and next year
    const currentYearSeasons = getSeasonsForYear(year);
    const nextYearSeasons = getSeasonsForYear(year + 1);

    // All seasonal events in order
    const allEvents: Array<{ type: SeasonType; time: Date }> = [
      { type: 'march_equinox', time: currentYearSeasons.marchEquinox },
      { type: 'june_solstice', time: currentYearSeasons.juneSolstice },
      { type: 'september_equinox', time: currentYearSeasons.septemberEquinox },
      { type: 'december_solstice', time: currentYearSeasons.decemberSolstice },
      { type: 'march_equinox', time: nextYearSeasons.marchEquinox },
    ];

    // Find the next event within the window
    for (const event of allEvents) {
      const daysUntil = (event.time.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

      // Event must be in the future and within window
      if (daysUntil >= -1 && daysUntil <= windowDays) {
        return {
          type: event.type,
          time: event.time,
          daysUntil: Math.round(daysUntil),
        };
      }
    }

    return null;
  } catch (_error) {
    return null;
  }
}

/**
 * Get the current season based on date
 */
export function getCurrentSeason(
  date: Date,
  isNorthernHemisphere: boolean = true
): 'spring' | 'summer' | 'autumn' | 'winter' {
  const year = date.getFullYear();
  const seasons = getSeasonsForYear(year);

  const dateMs = date.getTime();

  let season: 'spring' | 'summer' | 'autumn' | 'winter';

  if (dateMs < seasons.marchEquinox.getTime()) {
    season = 'winter';
  } else if (dateMs < seasons.juneSolstice.getTime()) {
    season = 'spring';
  } else if (dateMs < seasons.septemberEquinox.getTime()) {
    season = 'summer';
  } else if (dateMs < seasons.decemberSolstice.getTime()) {
    season = 'autumn';
  } else {
    season = 'winter';
  }

  // Flip for Southern Hemisphere
  if (!isNorthernHemisphere) {
    const flipMap: Record<string, 'spring' | 'summer' | 'autumn' | 'winter'> = {
      spring: 'autumn',
      summer: 'winter',
      autumn: 'spring',
      winter: 'summer',
    };
    season = flipMap[season];
  }

  return season;
}

/**
 * Get human-readable description of seasonal marker
 */
export function describeSeasonalMarker(marker: SeasonalMarker): string {
  const descriptions: Record<SeasonType, string> = {
    march_equinox: 'March Equinox - day and night equal length',
    june_solstice: 'June Solstice - longest day in Northern Hemisphere',
    september_equinox: 'September Equinox - day and night equal length',
    december_solstice: 'December Solstice - shortest day in Northern Hemisphere',
  };

  return descriptions[marker.type];
}

/**
 * Get short name for seasonal marker
 */
export function getSeasonalMarkerName(type: SeasonType): string {
  const names: Record<SeasonType, string> = {
    march_equinox: 'Vernal Equinox',
    june_solstice: 'Summer Solstice',
    september_equinox: 'Autumnal Equinox',
    december_solstice: 'Winter Solstice',
  };

  return names[type];
}

/**
 * Check if a seasonal marker falls within the forecast window
 */
export function detectSeasonalMarkers(date: Date, forecastDays: number = 7): SeasonalMarker | null {
  return getNextSeasonalMarker(date, forecastDays);
}
