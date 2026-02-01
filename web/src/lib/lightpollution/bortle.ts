import type { BortleScore } from '@/types';

/**
 * Bortle Scale descriptions and corresponding naked eye limiting magnitudes
 */
const BORTLE_DATA: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, Omit<BortleScore, 'value'>> = {
  1: {
    label: 'Excellent Dark Site',
    nakedEyeLimitingMag: 7.6,
    description:
      'Zodiacal light, gegenschein, and zodiacal band visible. M33 visible with direct vision. Scorpius and Sagittarius extremely rich.',
  },
  2: {
    label: 'Typical Dark Site',
    nakedEyeLimitingMag: 7.1,
    description:
      'Airglow weakly visible near horizon. M33 easily visible with direct vision. Summer Milky Way highly structured.',
  },
  3: {
    label: 'Rural Sky',
    nakedEyeLimitingMag: 6.6,
    description:
      'Some light pollution evident at the horizon. Clouds illuminated near horizon. M15, M4, M5, M22 visible with naked eye.',
  },
  4: {
    label: 'Rural/Suburban Transition',
    nakedEyeLimitingMag: 6.2,
    description:
      'Light pollution domes visible in several directions. Milky Way still impressive overhead but lacks detail at horizon.',
  },
  5: {
    label: 'Suburban Sky',
    nakedEyeLimitingMag: 5.6,
    description:
      'Milky Way very weak or invisible near horizon. Light sources visible in most directions. Clouds noticeably brighter than sky.',
  },
  6: {
    label: 'Bright Suburban Sky',
    nakedEyeLimitingMag: 5.1,
    description:
      'Milky Way only visible near zenith. Sky within 35° of horizon glows grayish white. Clouds appear fairly bright.',
  },
  7: {
    label: 'Suburban/Urban Transition',
    nakedEyeLimitingMag: 4.6,
    description:
      'Entire sky has grayish-white hue. Strong light sources visible in all directions. Milky Way invisible.',
  },
  8: {
    label: 'City Sky',
    nakedEyeLimitingMag: 4.1,
    description:
      'Sky glows whitish gray or orange. You can read headlines without difficulty. M31 and M44 barely glimpsed by experienced observer.',
  },
  9: {
    label: 'Inner-City Sky',
    nakedEyeLimitingMag: 3.5,
    description:
      'Entire sky is brightly lit. Many stars making up constellation patterns invisible. Only the Moon, planets, and a few bright stars visible.',
  },
};

/**
 * Light pollution data grid - simplified dataset covering major population centers
 * Values represent estimated Bortle class based on population density and location
 * Format: [minLat, maxLat, minLon, maxLon, bortleValue]
 */
const LIGHT_POLLUTION_ZONES: [number, number, number, number, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9][] =
  [
    // Major US cities
    [40.5, 41.0, -74.3, -73.7, 9], // New York City
    [33.9, 34.2, -118.5, -118.1, 9], // Los Angeles
    [41.7, 42.0, -87.9, -87.5, 9], // Chicago
    [29.6, 29.9, -95.6, -95.2, 8], // Houston
    [33.3, 33.6, -112.2, -111.9, 8], // Phoenix
    [39.8, 40.1, -75.3, -75.0, 9], // Philadelphia
    [29.3, 29.5, -98.6, -98.3, 7], // San Antonio
    [32.6, 32.9, -117.3, -117.0, 8], // San Diego
    [32.6, 32.9, -97.0, -96.6, 7], // Dallas
    [37.3, 37.5, -122.1, -121.8, 8], // San Jose/Silicon Valley
    [37.7, 37.9, -122.5, -122.3, 9], // San Francisco
    [47.5, 47.7, -122.5, -122.2, 7], // Seattle
    [39.6, 39.8, -105.1, -104.8, 7], // Denver
    [42.3, 42.4, -71.2, -70.9, 9], // Boston
    [25.7, 25.9, -80.3, -80.1, 8], // Miami

    // Major European cities
    [51.4, 51.6, -0.3, 0.1, 9], // London
    [48.8, 49.0, 2.2, 2.5, 9], // Paris
    [52.4, 52.6, 13.2, 13.5, 8], // Berlin
    [40.3, 40.5, -3.8, -3.5, 8], // Madrid
    [41.8, 42.0, 12.4, 12.6, 8], // Rome
    [50.8, 51.0, 4.2, 4.5, 8], // Brussels
    [52.3, 52.5, 4.8, 5.0, 9], // Amsterdam
    [48.1, 48.3, 16.3, 16.5, 8], // Vienna
    [59.3, 59.4, 17.9, 18.2, 7], // Stockholm
    [55.6, 55.8, 12.4, 12.7, 7], // Copenhagen

    // Major Asian cities
    [35.6, 35.8, 139.6, 139.9, 9], // Tokyo
    [37.5, 37.6, 126.9, 127.1, 9], // Seoul
    [31.1, 31.4, 121.3, 121.6, 9], // Shanghai
    [39.8, 40.0, 116.3, 116.5, 9], // Beijing
    [22.2, 22.4, 114.1, 114.3, 9], // Hong Kong
    [1.2, 1.4, 103.7, 104.0, 9], // Singapore
    [13.7, 13.8, 100.4, 100.6, 8], // Bangkok
    [28.5, 28.7, 77.1, 77.3, 8], // Delhi
    [19.0, 19.2, 72.8, 73.0, 9], // Mumbai

    // Australia
    [-33.95, -33.8, 150.9, 151.3, 8], // Sydney
    [-37.9, -37.7, 144.8, 145.1, 8], // Melbourne
    [-27.55, -27.4, 152.9, 153.1, 7], // Brisbane
    [-31.98, -31.9, 115.8, 116.0, 7], // Perth

    // South America
    [-23.65, -23.45, -46.8, -46.5, 9], // Sao Paulo
    [-22.95, -22.85, -43.3, -43.1, 8], // Rio de Janeiro
    [-34.7, -34.5, -58.5, -58.3, 8], // Buenos Aires
    [-33.5, -33.4, -70.7, -70.5, 7], // Santiago
  ];

/**
 * Calculate approximate Bortle score from latitude/longitude
 * Uses a combination of hardcoded zones and population density heuristics
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Location-based heuristics require multiple conditions
export function calculateBortle(lat: number, lon: number): BortleScore {
  // Check if location falls within a known light pollution zone
  for (const zone of LIGHT_POLLUTION_ZONES) {
    const [minLat, maxLat, minLon, maxLon, bortle] = zone;
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      return {
        value: bortle,
        ...BORTLE_DATA[bortle],
      };
    }
  }

  // Heuristic based on latitude bands (population density tends to follow latitude)
  // Mid-latitudes (30-60°) in both hemispheres tend to be more populated
  const absLat = Math.abs(lat);

  // Very high latitudes (Arctic/Antarctic) - typically dark
  if (absLat > 70) {
    const value = 2 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Remote ocean locations (check if far from any major landmass)
  // Pacific ocean (central Pacific)
  if (lat > -30 && lat < 30 && lon > -170 && lon < -100) {
    const value = 1 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Atlantic ocean (central)
  if (lat > -30 && lat < 30 && lon > -50 && lon < -10) {
    const value = 1 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Indian ocean
  if (lat > -30 && lat < 10 && lon > 60 && lon < 90) {
    const value = 1 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // General heuristic based on latitude
  // Tropical regions outside cities
  if (absLat < 25) {
    const value = 4 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Temperate mid-latitudes (most populated)
  if (absLat >= 25 && absLat <= 55) {
    const value = 5 as const; // Suburban default
    return { value, ...BORTLE_DATA[value] };
  }

  // Higher latitudes (less populated)
  if (absLat > 55 && absLat <= 70) {
    const value = 3 as const;
    return { value, ...BORTLE_DATA[value] };
  }

  // Default fallback - suburban
  const value = 5 as const;
  return { value, ...BORTLE_DATA[value] };
}

/**
 * Get color class for Bortle value
 */
export function getBortleColorClass(bortle: BortleScore['value']): string {
  if (bortle <= 3) return 'text-green-400';
  if (bortle <= 5) return 'text-yellow-400';
  if (bortle <= 7) return 'text-orange-400';
  return 'text-red-400';
}

/**
 * Get background color class for Bortle badge
 */
export function getBortleBgClass(bortle: BortleScore['value']): string {
  if (bortle <= 3) return 'bg-green-500/20';
  if (bortle <= 5) return 'bg-yellow-500/20';
  if (bortle <= 7) return 'bg-orange-500/20';
  return 'bg-red-500/20';
}
