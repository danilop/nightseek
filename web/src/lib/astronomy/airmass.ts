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
  const denominator = Math.sin(((h + 244 / (165 + 47 * h ** 1.1)) * Math.PI) / 180);

  return 1 / denominator;
}
