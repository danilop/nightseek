import * as Astronomy from 'astronomy-engine';
import type { PlanetaryTransit } from '@/types';

/**
 * Planetary transits are rare events where Mercury or Venus crosses
 * the disk of the Sun as seen from Earth.
 *
 * Typical intervals:
 * - Mercury: ~13-14 transits per century (every 3-13 years)
 * - Venus: Very rare - pairs 8 years apart, separated by 105-122 years
 *
 * Next transits:
 * - Mercury: November 13, 2032
 * - Venus: December 11, 2117
 */

/**
 * Years to display alert banner for upcoming transit
 */
const TRANSIT_ALERT_YEARS = 2;

/**
 * Search for the next transit of a planet
 */
function searchNextTransit(
  body: Astronomy.Body.Mercury | Astronomy.Body.Venus,
  startDate: Date
): Astronomy.TransitInfo | null {
  try {
    // SearchTransit requires a date and returns the next transit
    const transit = Astronomy.SearchTransit(body, startDate);
    return transit;
  } catch (_error) {
    return null;
  }
}

/**
 * Convert astronomy-engine transit info to our PlanetaryTransit type
 */
function convertTransitInfo(
  planet: 'Mercury' | 'Venus',
  transit: Astronomy.TransitInfo,
  referenceDate: Date
): PlanetaryTransit {
  const yearsUntil =
    (transit.peak.date.getTime() - referenceDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  return {
    planet,
    start: transit.start.date,
    peak: transit.peak.date,
    finish: transit.finish.date,
    separationArcmin: transit.separation * 60, // Convert degrees to arcminutes
    yearsUntil: Math.round(yearsUntil * 10) / 10, // One decimal place
  };
}

/**
 * Get the next Mercury transit
 */
export function getNextMercuryTransit(startDate: Date): PlanetaryTransit | null {
  const transit = searchNextTransit(Astronomy.Body.Mercury, startDate);
  if (!transit) return null;

  return convertTransitInfo('Mercury', transit, startDate);
}

/**
 * Get the next Venus transit
 */
export function getNextVenusTransit(startDate: Date): PlanetaryTransit | null {
  const transit = searchNextTransit(Astronomy.Body.Venus, startDate);
  if (!transit) return null;

  return convertTransitInfo('Venus', transit, startDate);
}

/**
 * Get all upcoming transits for both Mercury and Venus within a time window
 */
export function getNextTransits(startDate: Date, searchYears: number = 15): PlanetaryTransit[] {
  const transits: PlanetaryTransit[] = [];
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + searchYears);

  // Search Mercury transits
  let mercurySearch = new Date(startDate);
  while (mercurySearch < endDate) {
    const transit = searchNextTransit(Astronomy.Body.Mercury, mercurySearch);
    if (!transit || transit.peak.date > endDate) break;

    transits.push(convertTransitInfo('Mercury', transit, startDate));

    // Move search date past this transit
    mercurySearch = new Date(transit.finish.date);
    mercurySearch.setDate(mercurySearch.getDate() + 1);
  }

  // Search Venus transits (these are very rare)
  const venusTransit = searchNextTransit(Astronomy.Body.Venus, startDate);
  if (venusTransit && venusTransit.peak.date <= endDate) {
    transits.push(convertTransitInfo('Venus', venusTransit, startDate));
  }

  // Sort by date
  transits.sort((a, b) => a.peak.getTime() - b.peak.getTime());

  return transits;
}

/**
 * Get the nearest upcoming transit (either Mercury or Venus)
 */
export function getNearestTransit(startDate: Date): PlanetaryTransit | null {
  const mercuryTransit = getNextMercuryTransit(startDate);
  const venusTransit = getNextVenusTransit(startDate);

  if (!mercuryTransit && !venusTransit) return null;
  if (!mercuryTransit) return venusTransit;
  if (!venusTransit) return mercuryTransit;

  // Return whichever is sooner
  return mercuryTransit.peak.getTime() < venusTransit.peak.getTime()
    ? mercuryTransit
    : venusTransit;
}

/**
 * Check if a transit should be displayed as an alert
 * (within the alert window of years)
 */
export function shouldShowTransitAlert(transit: PlanetaryTransit): boolean {
  return transit.yearsUntil <= TRANSIT_ALERT_YEARS;
}

/**
 * Get transit information for UI display
 */
export function getTransitForDisplay(startDate: Date): PlanetaryTransit | null {
  const nearest = getNearestTransit(startDate);

  if (!nearest) return null;

  // Only return if within reasonable display window
  // Mercury transits: show if within 5 years
  // Venus transits: always show (they're so rare!)
  if (nearest.planet === 'Mercury' && nearest.yearsUntil > 5) {
    return null;
  }

  return nearest;
}

/**
 * Get description text for a transit
 */
export function getTransitDescription(transit: PlanetaryTransit): string {
  const dateStr = transit.peak.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const durationMinutes = Math.round(
    (transit.finish.getTime() - transit.start.getTime()) / (60 * 1000)
  );
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;

  const durationStr =
    durationHours > 0 ? `${durationHours}h ${remainingMinutes}m` : `${remainingMinutes}m`;

  if (transit.yearsUntil < 1) {
    const monthsUntil = Math.round(transit.yearsUntil * 12);
    return `${transit.planet} Transit on ${dateStr} (${monthsUntil} months away) - Duration: ${durationStr}`;
  }

  return `${transit.planet} Transit on ${dateStr} (${transit.yearsUntil} years away) - Duration: ${durationStr}`;
}

/**
 * Get a short summary for transit alerts
 */
export function getTransitAlertSummary(transit: PlanetaryTransit): string {
  if (transit.yearsUntil < 1) {
    const monthsUntil = Math.round(transit.yearsUntil * 12);
    return `${transit.planet} transit in ${monthsUntil} months!`;
  }

  if (transit.yearsUntil <= 2) {
    return `${transit.planet} transit in ${Math.round(transit.yearsUntil * 10) / 10} years`;
  }

  return `Next ${transit.planet} transit: ${transit.yearsUntil.toFixed(0)} years`;
}
