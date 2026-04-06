import { describe, expect, it } from 'vitest';
import { createMockNightWeather, createMockObjectVisibility } from '@/test/factories';
import type { HorizonProfile, Location } from '@/types';
import {
  createDefaultHorizonProfile,
  cycleSectorMinAltitude,
  evaluateTargetAccessibility,
  getHorizonProfileCacheKey,
  getMinVisibleAltitudeForAzimuth,
  getSectorAltitudeLabel,
} from './horizon-profile';

function createProfile(
  overrides: Partial<Record<HorizonProfile['sectors'][number]['label'], number>>
) {
  return {
    sectors: createDefaultHorizonProfile().sectors.map(sector => ({
      ...sector,
      minAltitude: overrides[sector.label] ?? sector.minAltitude,
    })),
  } satisfies HorizonProfile;
}

describe('horizon-profile utilities', () => {
  it('creates an open default profile for all sectors', () => {
    const profile = createDefaultHorizonProfile();

    expect(profile.sectors).toHaveLength(8);
    expect(profile.sectors.every(sector => sector.minAltitude === 0)).toBe(true);
  });

  it('builds a location-scoped cache key from rounded coordinates', () => {
    const location: Location = {
      latitude: 51.5074,
      longitude: -0.1278,
    };

    expect(getHorizonProfileCacheKey(location)).toBe('nightseek:horizon:51.51,-0.13');
  });

  it('maps azimuth to the correct sector altitude', () => {
    const profile = createProfile({ S: 45, SW: 30 });

    expect(getMinVisibleAltitudeForAzimuth(profile, 180)).toBe(45);
    expect(getMinVisibleAltitudeForAzimuth(profile, 224)).toBe(30);
  });

  it('cycles altitude levels through open to blocked and back', () => {
    expect(cycleSectorMinAltitude(0)).toBe(15);
    expect(cycleSectorMinAltitude(15)).toBe(30);
    expect(cycleSectorMinAltitude(30)).toBe(45);
    expect(cycleSectorMinAltitude(45)).toBe(90);
    expect(cycleSectorMinAltitude(90)).toBe(0);
  });

  it('returns user-facing labels for altitude levels', () => {
    expect(getSectorAltitudeLabel(0)).toBe('Open');
    expect(getSectorAltitudeLabel(30)).toBe('30°+');
    expect(getSectorAltitudeLabel(90)).toBe('Blocked');
  });

  it('marks a target inaccessible when all samples stay below the local horizon', () => {
    const profile = createProfile({ S: 45 });
    const object = createMockObjectVisibility({
      altitudeSamples: [
        [new Date('2025-01-15T22:00:00Z'), 20],
        [new Date('2025-01-15T22:10:00Z'), 25],
        [new Date('2025-01-15T22:20:00Z'), 30],
      ],
      azimuthSamples: [
        [new Date('2025-01-15T22:00:00Z'), 180],
        [new Date('2025-01-15T22:10:00Z'), 180],
        [new Date('2025-01-15T22:20:00Z'), 180],
      ],
    });

    const accessibility = evaluateTargetAccessibility(object, profile, null);

    expect(accessibility.isAccessible).toBe(false);
    expect(accessibility.accessibleMinutes).toBe(0);
  });

  it('rewards overlap with the best observing window', () => {
    const profile = createProfile({ S: 15 });
    const weather = createMockNightWeather({
      bestTime: {
        start: new Date('2025-01-15T22:10:00Z'),
        end: new Date('2025-01-15T22:30:00Z'),
        score: 90,
        reason: 'Clear skies',
      },
    });
    const object = createMockObjectVisibility({
      altitudeSamples: [
        [new Date('2025-01-15T22:00:00Z'), 20],
        [new Date('2025-01-15T22:10:00Z'), 25],
        [new Date('2025-01-15T22:20:00Z'), 25],
      ],
      azimuthSamples: [
        [new Date('2025-01-15T22:00:00Z'), 180],
        [new Date('2025-01-15T22:10:00Z'), 180],
        [new Date('2025-01-15T22:20:00Z'), 180],
      ],
    });

    const accessibility = evaluateTargetAccessibility(object, profile, weather);

    expect(accessibility.isAccessible).toBe(true);
    expect(accessibility.accessibleMinutes).toBe(30);
    expect(accessibility.bestWindowOverlapMinutes).toBe(20);
    expect(accessibility.priorityScore).toBeGreaterThan(accessibility.accessibleMinutes);
  });
});
