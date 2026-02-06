import * as Astronomy from 'astronomy-engine';

/**
 * Get Greenwich Mean Sidereal Time (GMST) in hours
 *
 * Sidereal time is the hour angle of the vernal equinox,
 * representing the current orientation of Earth relative to the stars.
 */
export function getGreenwichSiderealTime(date: Date): number {
  return Astronomy.SiderealTime(date);
}

/**
 * Get Local Sidereal Time (LST) in hours
 *
 * LST = GMST + longitude/15 (converting degrees to hours)
 * This tells you which RA is currently on your meridian.
 */
export function getLocalSiderealTimeHours(date: Date, longitudeDeg: number): number {
  const gmst = Astronomy.SiderealTime(date);
  let lst = gmst + longitudeDeg / 15;

  // Normalize to 0-24 hours
  while (lst < 0) lst += 24;
  while (lst >= 24) lst -= 24;

  return lst;
}

/**
 * Get Local Sidereal Time formatted as a string "HHh MMm"
 *
 * @param date - The date/time to calculate LST for
 * @param longitudeDeg - Observer's longitude in degrees (positive = East)
 * @returns Formatted string like "14h 32m"
 */
export function getLocalSiderealTime(date: Date, longitudeDeg: number): string {
  const lstHours = getLocalSiderealTimeHours(date, longitudeDeg);

  const hours = Math.floor(lstHours);
  const minutes = Math.round((lstHours - hours) * 60);

  // Handle case where minutes rounds to 60
  if (minutes >= 60) {
    return `${(hours + 1) % 24}h 00m`;
  }

  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

/**
 * Calculate what RA is currently on the meridian
 * This is equivalent to LST (in hours)
 */
export function getMeridianRA(date: Date, longitudeDeg: number): number {
  return getLocalSiderealTimeHours(date, longitudeDeg);
}

/**
 * Check if an object is near the meridian based on its RA
 *
 * @param objectRA - Object's Right Ascension in hours
 * @param date - Current date/time
 * @param longitudeDeg - Observer's longitude
 * @param toleranceHours - How close to meridian (default 1 hour)
 * @returns True if object is within tolerance of meridian
 */
export function isNearMeridian(
  objectRA: number,
  date: Date,
  longitudeDeg: number,
  toleranceHours: number = 1
): boolean {
  const meridianRA = getMeridianRA(date, longitudeDeg);

  let diff = Math.abs(objectRA - meridianRA);
  // Handle wrap-around at 24 hours
  if (diff > 12) {
    diff = 24 - diff;
  }

  return diff <= toleranceHours;
}

/**
 * Calculate the angular rate of sidereal time
 * Sidereal time advances ~4 minutes faster than solar time per day
 *
 * @returns Rate in sidereal hours per solar hour (approximately 1.00274)
 */
export function getSiderealRate(): number {
  // A sidereal day is about 23h 56m 4s
  // So sidereal time gains about 3m 56s per day compared to solar time
  return 24.0 / 23.9344696; // ~1.00274
}

/**
 * Convert between sidereal and solar time intervals
 */
export function solarToSiderealHours(solarHours: number): number {
  return solarHours * getSiderealRate();
}

export function siderealToSolarHours(siderealHours: number): number {
  return siderealHours / getSiderealRate();
}
