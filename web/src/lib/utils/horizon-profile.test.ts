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
  normalizeHorizonProfile,
} from './horizon-profile';

function createProfile(
  overrides: Partial<Record<HorizonProfile['sectors'][number]['label'], number>>
) {
  const profile = createDefaultHorizonProfile();
  return {
    ...profile,
    sectors: profile.sectors.map(sector => ({
      ...sector,
      minAltitude: overrides[sector.label] ?? sector.minAltitude,
    })),
  } satisfies HorizonProfile;
}

describe('horizon-profile utilities', () => {
  it('creates an open default profile for all sectors', () => {
    const profile = createDefaultHorizonProfile();

    expect(profile.sectors).toHaveLength(8);
    expect(profile.minimumAltitude).toBe(0);
    expect(profile.sectors.every(sector => sector.minAltitude === 0)).toBe(true);
  });

  it('builds a site-specific cache key at approximately metre precision', () => {
    const location: Location = {
      latitude: 51.5074,
      longitude: -0.1278,
    };

    expect(getHorizonProfileCacheKey(location)).toBe('nightseek:horizon:51.50740,-0.12780');
    expect(getHorizonProfileCacheKey({ latitude: 51.50749, longitude: -0.1278 })).not.toBe(
      getHorizonProfileCacheKey(location)
    );
  });

  it('maps azimuth to the correct sector altitude', () => {
    const profile = createProfile({ S: 45, SW: 30 });

    expect(getMinVisibleAltitudeForAzimuth(profile, 180)).toBe(45);
    expect(getMinVisibleAltitudeForAzimuth(profile, 224)).toBe(30);
  });

  it('uses exact 22.5-degree boundaries and wraps north correctly', () => {
    const profile = createProfile({ N: 15, NE: 30, NW: 45 });

    expect(getMinVisibleAltitudeForAzimuth(profile, 22.49)).toBe(15);
    expect(getMinVisibleAltitudeForAzimuth(profile, 22.51)).toBe(30);
    expect(getMinVisibleAltitudeForAzimuth(profile, 337.49)).toBe(45);
    expect(getMinVisibleAltitudeForAzimuth(profile, 337.51)).toBe(15);
    expect(getMinVisibleAltitudeForAzimuth(profile, 360)).toBe(15);
  });

  it('combines the whole-sky minimum with directional obstructions', () => {
    const profile = { ...createProfile({ S: 15, W: 45 }), minimumAltitude: 30 };

    expect(getMinVisibleAltitudeForAzimuth(profile, 180)).toBe(30);
    expect(getMinVisibleAltitudeForAzimuth(profile, 270)).toBe(45);
  });

  it('normalizes legacy cached profiles and restores canonical sector order', () => {
    const normalized = normalizeHorizonProfile({
      minimumAltitude: 90,
      sectors: [
        { label: 'S', centerAzimuth: 999, minAltitude: 45 },
        { label: 'N', centerAzimuth: 999, minAltitude: 15 },
      ],
    });

    expect(normalized.minimumAltitude).toBe(60);
    expect(normalized.sectors.map(sector => sector.label)).toEqual([
      'N',
      'NE',
      'E',
      'SE',
      'S',
      'SW',
      'W',
      'NW',
    ]);
    expect(normalized.sectors[0]).toMatchObject({ centerAzimuth: 0, minAltitude: 15 });
    expect(normalized.sectors[4]).toMatchObject({ centerAzimuth: 180, minAltitude: 45 });
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
    expect(accessibility.accessibleMinutes).toBe(20);
    expect(accessibility.bestWindowOverlapMinutes).toBe(10);
    expect(accessibility.bestWindow?.start).toEqual(new Date('2025-01-15T22:00:00Z'));
    expect(accessibility.bestWindow?.end).toEqual(new Date('2025-01-15T22:20:00Z'));
    expect(accessibility.priorityScore).toBeGreaterThan(accessibility.accessibleMinutes);
  });

  it('interpolates threshold crossings to produce useful start and end times', () => {
    const profile = { ...createDefaultHorizonProfile(), minimumAltitude: 30 };
    const object = createMockObjectVisibility({
      altitudeSamples: [
        [new Date('2025-01-15T22:00:00Z'), 20],
        [new Date('2025-01-15T22:10:00Z'), 40],
        [new Date('2025-01-15T22:20:00Z'), 20],
      ],
      azimuthSamples: [
        [new Date('2025-01-15T22:00:00Z'), 180],
        [new Date('2025-01-15T22:10:00Z'), 180],
        [new Date('2025-01-15T22:20:00Z'), 180],
      ],
    });

    const accessibility = evaluateTargetAccessibility(object, profile, null);

    expect(accessibility.windows).toHaveLength(1);
    expect(accessibility.bestWindow?.start).toEqual(new Date('2025-01-15T22:05:00Z'));
    expect(accessibility.bestWindow?.end).toEqual(new Date('2025-01-15T22:15:00Z'));
    expect(accessibility.accessibleMinutes).toBe(10);
  });

  it('splits a window exactly when a target crosses into a blocked sector', () => {
    const profile = createProfile({ S: 90 });
    const object = createMockObjectVisibility({
      altitudeSamples: [
        [new Date('2025-01-15T22:00:00Z'), 50],
        [new Date('2025-01-15T22:10:00Z'), 50],
      ],
      azimuthSamples: [
        [new Date('2025-01-15T22:00:00Z'), 150],
        [new Date('2025-01-15T22:10:00Z'), 180],
      ],
    });

    const accessibility = evaluateTargetAccessibility(object, profile, null);

    expect(accessibility.windows).toHaveLength(1);
    expect(accessibility.bestWindow?.start).toEqual(new Date('2025-01-15T22:00:00Z'));
    expect(accessibility.bestWindow?.end.getTime()).toBeCloseTo(
      new Date('2025-01-15T22:02:30Z').getTime(),
      -2
    );
  });

  it('treats a blocked sector as inaccessible even at 90 degrees altitude', () => {
    const profile = createProfile({ S: 90 });
    const object = createMockObjectVisibility({
      altitudeSamples: [
        [new Date('2025-01-15T22:00:00Z'), 90],
        [new Date('2025-01-15T22:10:00Z'), 90],
      ],
      azimuthSamples: [
        [new Date('2025-01-15T22:00:00Z'), 180],
        [new Date('2025-01-15T22:10:00Z'), 180],
      ],
    });

    expect(evaluateTargetAccessibility(object, profile, null).isAccessible).toBe(false);
  });
});
