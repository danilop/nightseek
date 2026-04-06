import { Geolocation } from '@capacitor/geolocation';
import type { Location } from '@/types';

/**
 * Detect location using IP geolocation (same as web version)
 */
export async function detectLocationByIP(): Promise<Location | null> {
  try {
    const response = await fetch('https://ipwho.is/');
    const data = await response.json();

    if (!data.success) return null;

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      name: `${data.city}, ${data.country}`,
      timezone: data.timezone?.id,
    };
  } catch {
    return null;
  }
}

/**
 * Detect location using Capacitor native geolocation.
 * Uses the native iOS permission dialog with Info.plist usage description.
 */
export async function detectLocationByBrowser(): Promise<Location | null> {
  try {
    let permStatus = await Geolocation.checkPermissions();

    if (permStatus.location === 'prompt') {
      permStatus = await Geolocation.requestPermissions();
    }

    if (permStatus.location !== 'granted') {
      return null;
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10000,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
  } catch {
    return null;
  }
}

/**
 * Geocode an address to coordinates (same as web version)
 */
export async function geocodeAddress(address: string): Promise<Location | null> {
  try {
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '1',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'NightSeek-App/1.0.0',
      },
    });

    const results = await response.json();
    if (results.length === 0) return null;

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
      name: results[0].display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Reverse geocode coordinates to a place name (same as web version)
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      format: 'json',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        'User-Agent': 'NightSeek-App/1.0.0',
      },
    });

    const result = await response.json();
    if (result.error) return null;

    const address = result.address;
    const name = address.city || address.town || address.village || address.county;
    const country = address.country;

    if (name && country) {
      return `${name}, ${country}`;
    }

    return result.display_name?.split(',').slice(0, 2).join(',') || null;
  } catch {
    return null;
  }
}

/**
 * Validate coordinates (same as web version)
 */
export function validateCoordinates(latitude: number, longitude: number): boolean {
  return (
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Format coordinates for display (same as web version)
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}°${latDir}, ${Math.abs(longitude).toFixed(4)}°${lonDir}`;
}
