import type { PlanetData } from '@/types';

// Physical diameters in km
export const PLANET_DIAMETERS: Record<string, number> = {
  mercury: 4879,
  venus: 12104,
  mars: 6779,
  jupiter: 139820,
  saturn: 116460,
  uranus: 50724,
  neptune: 49244,
};

// Historical min/max apparent diameters in arcseconds
export const PLANET_DIAMETER_RANGES: Record<string, [number, number]> = {
  mercury: [4.5, 13.0],
  venus: [9.7, 66.0],
  mars: [3.5, 25.1],
  jupiter: [29.8, 50.1],
  saturn: [14.5, 20.1],
  uranus: [3.3, 4.1],
  neptune: [2.2, 2.4],
};

export const PLANETS: PlanetData[] = [
  { name: 'Mercury', physicalDiameter: 4879, apparentDiameterMin: 4.5, apparentDiameterMax: 13.0 },
  { name: 'Venus', physicalDiameter: 12104, apparentDiameterMin: 9.7, apparentDiameterMax: 66.0 },
  { name: 'Mars', physicalDiameter: 6779, apparentDiameterMin: 3.5, apparentDiameterMax: 25.1 },
  {
    name: 'Jupiter',
    physicalDiameter: 139820,
    apparentDiameterMin: 29.8,
    apparentDiameterMax: 50.1,
  },
  {
    name: 'Saturn',
    physicalDiameter: 116460,
    apparentDiameterMin: 14.5,
    apparentDiameterMax: 20.1,
  },
  { name: 'Uranus', physicalDiameter: 50724, apparentDiameterMin: 3.3, apparentDiameterMax: 4.1 },
  { name: 'Neptune', physicalDiameter: 49244, apparentDiameterMin: 2.2, apparentDiameterMax: 2.4 },
];

/**
 * Calculate planet apparent diameter
 *
 * @param planetName - Planet name (lowercase)
 * @param distanceKm - Distance from Earth in km
 * @returns Apparent diameter in arcseconds
 */
export function calculateApparentDiameter(planetName: string, distanceKm: number): number {
  const physicalDiameter = PLANET_DIAMETERS[planetName.toLowerCase()];
  if (!physicalDiameter || distanceKm <= 0) return 0;

  const angularDiameterRad = physicalDiameter / distanceKm;
  return angularDiameterRad * 206265; // Convert to arcseconds
}

/**
 * Get planet data by name
 */
export function getPlanetData(name: string): PlanetData | undefined {
  return PLANETS.find(p => p.name.toLowerCase() === name.toLowerCase());
}
