/**
 * Asteroid physical data
 *
 * Hardcoded from JPL SBDB (https://ssd-api.jpl.nasa.gov/doc/sbdb.html)
 * because the API doesn't support CORS for browser requests.
 * Only 4 asteroids are tracked, so this is simpler and more reliable.
 */

import type { AsteroidPhysicalData } from '@/types';

const ASTEROID_DATA: Record<string, AsteroidPhysicalData> = {
  vesta: { diameter: 525.4, albedo: 0.4228, spectralType: 'V', rotationPeriod: 5.3421 },
  pallas: { diameter: 513, albedo: 0.101, spectralType: 'B', rotationPeriod: 7.8132 },
  juno: { diameter: 233.92, albedo: 0.2383, spectralType: 'S', rotationPeriod: 7.21 },
  hygiea: { diameter: 433, albedo: 0.0717, spectralType: 'C', rotationPeriod: 27.659 },
};

/**
 * Get physical data for an asteroid
 */
export function fetchAsteroidPhysicalData(
  designation: string
): Promise<AsteroidPhysicalData | null> {
  const key = designation.toLowerCase().replace(/\s+/g, '');
  return Promise.resolve(ASTEROID_DATA[key] ?? null);
}

/**
 * Format rotation period for display
 */
export function formatRotationPeriod(hours: number | null): string | null {
  if (hours === null) return null;

  if (hours < 1) {
    return `${(hours * 60).toFixed(1)} min`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)} hr`;
  }
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
}

/**
 * Format diameter for display
 */
export function formatAsteroidDiameter(km: number | null): string | null {
  if (km === null) return null;

  if (km < 1) {
    return `${(km * 1000).toFixed(0)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${km.toFixed(0)} km`;
}
