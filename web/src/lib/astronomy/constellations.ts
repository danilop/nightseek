import * as Astronomy from 'astronomy-engine';

/**
 * Look up the constellation containing the given equatorial coordinates
 * @param raHours Right ascension in hours (0-24)
 * @param decDegrees Declination in degrees (-90 to +90)
 * @returns Constellation name (e.g., "Orion", "Leo", etc.)
 */
export function getConstellation(raHours: number, decDegrees: number): string {
  try {
    const constellation = Astronomy.Constellation(raHours * 15, decDegrees);
    return constellation.name;
  } catch (_error) {
    return 'Unknown';
  }
}

/**
 * Get constellation info with symbol
 * @param raHours Right ascension in hours (0-24)
 * @param decDegrees Declination in degrees (-90 to +90)
 * @returns Object with name and symbol
 */
export function getConstellationInfo(
  raHours: number,
  decDegrees: number
): { name: string; symbol: string } {
  try {
    const constellation = Astronomy.Constellation(raHours * 15, decDegrees);
    return {
      name: constellation.name,
      symbol: constellation.symbol,
    };
  } catch (_error) {
    return { name: 'Unknown', symbol: '?' };
  }
}

/**
 * Get constellation for a planet at a given time
 */
export function getPlanetConstellation(
  body: Astronomy.Body,
  time: Date,
  observer: Astronomy.Observer
): string {
  try {
    const equator = Astronomy.Equator(body, time, observer, true, true);
    return getConstellation(equator.ra, equator.dec);
  } catch (_error) {
    return 'Unknown';
  }
}
