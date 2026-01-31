/**
 * Calculate airmass using Pickering (2002) formula
 * More accurate than secant formula, especially at low altitudes
 *
 * @param altitudeDeg - Altitude above horizon in degrees
 * @returns Airmass (1.0 at zenith, higher = more atmosphere)
 */
export function calculateAirmass(altitudeDeg: number): number {
  if (altitudeDeg <= 0) return Infinity;
  if (altitudeDeg >= 90) return 1.0;

  const h = altitudeDeg;
  const denominator = Math.sin(
    ((h + 244 / (165 + 47 * Math.pow(h, 1.1))) * Math.PI) / 180
  );

  return 1 / denominator;
}

/**
 * Get altitude quality description
 */
export function getAltitudeQuality(altitude: number): string {
  if (altitude >= 75) return 'Excellent';
  if (altitude >= 60) return 'Very Good';
  if (altitude >= 45) return 'Good';
  if (altitude >= 30) return 'Fair';
  return 'Poor';
}

/**
 * Get cardinal direction from azimuth
 */
export function getCardinalDirection(azimuth: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                      'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(azimuth / 22.5) % 16;
  return directions[index];
}
