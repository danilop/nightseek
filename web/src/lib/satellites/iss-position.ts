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
 * Uses reverse geocoding to find the country/ocean
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: geographic region detection requires many conditions
export async function getISSLocationName(latitude: number, longitude: number): Promise<string> {
  // For over ocean areas, provide descriptive names
  if (longitude >= -180 && longitude <= -30 && latitude >= -60 && latitude <= 60) {
    // Atlantic Ocean region
    if (latitude > 30) return 'North Atlantic Ocean';
    if (latitude < -30) return 'South Atlantic Ocean';
    return 'Atlantic Ocean';
  }

  if (longitude >= 20 && longitude <= 145 && latitude >= -60 && latitude <= 60) {
    // Indian Ocean region
    if (longitude < 100 && latitude > -20 && latitude < 20) return 'Indian Ocean';
  }

  if ((longitude >= 100 || longitude <= -100) && latitude >= -60 && latitude <= 60) {
    // Pacific Ocean region
    if (latitude > 30) return 'North Pacific Ocean';
    if (latitude < -30) return 'South Pacific Ocean';
    return 'Pacific Ocean';
  }

  // For land areas, try to use a free reverse geocoding service
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=3`,
      {
        headers: {
          'User-Agent': 'NightSeek/1.0 (astronomical app)',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.address?.country) {
        return data.address.country;
      }
      if (data.display_name) {
        // Extract just the main location
        const parts = data.display_name.split(',');
        return parts[parts.length - 1]?.trim() || 'Unknown location';
      }
    }
  } catch {
    // Geocoding failed, use fallback
  }

  // Fallback: return coordinates
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
