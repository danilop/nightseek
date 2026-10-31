/**
 * Where the ISS at? API client
 * https://wheretheiss.at/w/developer
 *
 * Provides real-time ISS position data
 */

import type { ISSPosition } from '@/types';

// API base URL
const ISS_POSITION_API_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

interface ISSPositionApiResponse {
  name: string;
  id: number;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/h
  visibility: 'daylight' | 'eclipsed';
  footprint: number; // km
  timestamp: number;
  daynum: number;
  solar_lat: number;
  solar_lon: number;
  units: string;
}

/**
 * Fetch current ISS position
 */
export async function fetchISSPosition(): Promise<ISSPosition | null> {
  try {
    const response = await fetch(ISS_POSITION_API_URL);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ISSPositionApiResponse;

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude,
      velocity: data.velocity,
      visibility: data.visibility,
      timestamp: new Date(data.timestamp * 1000),
      footprint: data.footprint,
    };
  } catch {
    return null;
  }
}

/**
 * Get a human-readable location description for the ISS position
 * Return coordinates without guessing a country or ocean
 */
export async function getISSLocationName(latitude: number, longitude: number): Promise<string> {
  // Coordinates are honest and avoid repeated third-party reverse geocoding.
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(1)}°${latDir}, ${Math.abs(longitude).toFixed(1)}°${lonDir}`;
}

/**
 * Format velocity for display
 */
export function formatISSVelocity(kmh: number): string {
  return `${Math.round(kmh).toLocaleString()} km/h`;
}

/**
 * Format altitude for display
 */
export function formatISSAltitude(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

/**
 * Get visibility status description
 */
export function getVisibilityDescription(visibility: 'daylight' | 'eclipsed'): string {
  return visibility === 'daylight' ? 'In sunlight' : 'In Earth shadow';
}
