import type { Location } from '@/types';

/**
 * Detect location using IP geolocation
 */
export async function detectLocationByIP(): Promise<Location | null> {
  try {
    const response = await fetch(
      'http://ip-api.com/json/?fields=status,lat,lon,city,country,timezone'
    );
    const data = await response.json();

    if (data.status !== 'success') return null;

    return {
      latitude: data.lat,
      longitude: data.lon,
      name: `${data.city}, ${data.country}`,
      timezone: data.timezone,
    };
  } catch {
    return null;
  }
}

/**
 * Detect location using browser geolocation API
 */
export function detectLocationByBrowser(): Promise<Location | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  });
}

/**
 * Geocode an address to coordinates
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
        'User-Agent': 'NightSeek-PWA/1.0.0',
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
 * Reverse geocode coordinates to a place name
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
        'User-Agent': 'NightSeek-PWA/1.0.0',
      },
    });

    const result = await response.json();
    if (result.error) return null;

    // Extract city/town name
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
 * Validate coordinates
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
 * Format coordinates for display
 */
export function formatCoordinates(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}°${latDir}, ${Math.abs(longitude).toFixed(4)}°${lonDir}`;
}
