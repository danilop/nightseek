import { numeric, publicData, record } from '@/lib/api/public-data';
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
 * Fetch location from ipwho.is (HTTPS fallback, no API key required).
 */
async function fetchIpwhoisLocation(): Promise<Location | null> {
  const response = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(5000) });
  if (!response.ok) return null;

  const data = await response.json();
  if (!data.success) return null;

  if (data.latitude == null || data.longitude == null) return null;

  return {
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    name: `${data.city ?? 'Unknown'}, ${data.country ?? 'Unknown'}`,
    timezone: data.timezone?.id,
  };
}

/**
 * Detect location using IP geolocation with dual-provider fallback.
 * Primary: ipapi.co (HTTPS), Fallback: ipwho.is (HTTPS).
 */
export async function detectLocationByIP(): Promise<Location | null> {
  try {
    const result = await fetchIpapiLocation();
    if (result) return result;
  } catch {
    // Primary provider failed
  }

  try {
    return await fetchIpwhoisLocation();
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
  const query = address.trim();
  if (query.length < 2) return null;
  const params = new URLSearchParams({ name: query, count: '1', language: 'en', format: 'json' });
  return publicData(
    `geocode:${query.toLowerCase()}`,
    30 * 86_400_000,
    `https://geocoding-api.open-meteo.com/v1/search?${params}`,
    raw => {
      const results = record(raw).results;
      if (!Array.isArray(results) || !results.length) throw new Error('No matching place');
      const place = record(results[0]);
      const latitude = numeric(place.latitude);
      const longitude = numeric(place.longitude);
      if (latitude === null || longitude === null || !validateCoordinates(latitude, longitude))
        throw new Error('Invalid coordinates');
      return {
        latitude,
        longitude,
        name: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
        timezone: typeof place.timezone === 'string' ? place.timezone : undefined,
      };
    }
  );
}

/**
 * Reverse geocode coordinates to a place name
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  if (!validateCoordinates(latitude, longitude)) return null;
  const lat = latitude.toFixed(3);
  const lon = longitude.toFixed(3);
  const params = new URLSearchParams({ lat, lon, format: 'json' });
  return publicData(
    `reverse:${lat}:${lon}`,
    30 * 86_400_000,
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    raw => {
      const result = record(raw);
      if (result.error) throw new Error('Place unavailable');
      const address = record(result.address);
      const name = address.city || address.town || address.village || address.county;
      if (name && address.country) return `${name}, ${address.country}`;
      if (typeof result.display_name === 'string')
        return result.display_name.split(',').slice(0, 2).join(',');
      throw new Error('Place name unavailable');
    }
  );
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
