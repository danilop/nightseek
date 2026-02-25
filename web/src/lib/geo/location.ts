import type { Location } from '@/types';

/**
 * Fetch location from ipapi.co (HTTPS, primary provider).
 */
async function fetchIpapiLocation(): Promise<Location | null> {
  const response = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;

  const data = await response.json();
  if (data.error) return null;

  const lat = data.latitude ?? data.lat;
  const lon = data.longitude ?? data.lon;
  if (lat == null || lon == null) return null;

  return {
    latitude: Number(lat),
    longitude: Number(lon),
    name: `${data.city ?? 'Unknown'}, ${data.country_name ?? data.country ?? 'Unknown'}`,
    timezone: data.timezone,
  };
}

/**
 * Fetch location from ip-api.com (HTTP fallback).
 */
async function fetchIpApiLocation(): Promise<Location | null> {
  const response = await fetch(
    'http://ip-api.com/json/?fields=status,lat,lon,city,country,timezone',
    {
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!response.ok) return null;

  const data = await response.json();
  if (data.status !== 'success') return null;

  return {
    latitude: data.lat,
    longitude: data.lon,
    name: `${data.city ?? 'Unknown'}, ${data.country ?? 'Unknown'}`,
    timezone: data.timezone,
  };
}

/**
 * Detect location using IP geolocation with dual-provider fallback.
 * Primary: ipapi.co (HTTPS), Fallback: ip-api.com (HTTP).
 */
export async function detectLocationByIP(): Promise<Location | null> {
  try {
    const result = await fetchIpapiLocation();
    if (result) return result;
  } catch {
    // Primary provider failed
  }

  try {
    return await fetchIpApiLocation();
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
