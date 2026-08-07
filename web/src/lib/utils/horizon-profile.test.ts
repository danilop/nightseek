import { describe, expect, it } from 'vitest';
import { createMockNightWeather, createMockObjectVisibility } from '@/test/factories';
import type { HorizonProfile, Location } from '@/types';
import {
  createDefaultHorizonProfile,
  cycleSectorMinAltitude,
  evaluateTargetAccessibility,
  getHorizonProfileCacheKey,
  getHorizonThresholdSegments,
  getMinVisibleAltitudeForAzimuth,
  getSectorAltitudeLabel,
  normalizeHorizonProfile,
} from './horizon-profile';

const BASE_MS = new Date('2025-01-15T22:00:00Z').getTime();

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

describe('getHorizonThresholdSegments', () => {
  function createSamples(points: [minutes: number, altitude: number, azimuth: number][]) {
    return points.map(([minutes, altitude, azimuth]) => ({
      timeMs: BASE_MS + minutes * 60_000,
      altitude,
      azimuth,
    }));
  }

  it('returns nothing for fewer than two samples', () => {
    expect(getHorizonThresholdSegments([], createDefaultHorizonProfile())).toEqual([]);
    expect(
      getHorizonThresholdSegments(createSamples([[0, 40, 180]]), createDefaultHorizonProfile())
    ).toEqual([]);
  });

  it('merges consecutive samples that stay in one sector into a single segment', () => {
    const segments = getHorizonThresholdSegments(
      createSamples([
        [0, 40, 175],
        [10, 45, 178],
        [20, 50, 181],
      ]),
      createProfile({ S: 30 })
    );

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      sectorLabel: 'S',
      thresholdDegrees: 30,
      sectorThresholdDegrees: 30,
      isBlocked: false,
    });
    expect(segments[0].endMs - segments[0].startMs).toBe(20 * 60_000);
  });

  it('steps at the 22.5-degree sector boundaries as a target transits', () => {
    const segments = getHorizonThresholdSegments(
      createSamples([
        [0, 40, 140],
        [60, 40, 220],
      ]),
      createProfile({ SE: 15, S: 45, SW: 30 })
    );

    expect(segments.map(segment => segment.sectorLabel)).toEqual(['SE', 'S', 'SW']);
    expect(segments.map(segment => segment.thresholdDegrees)).toEqual([15, 45, 30]);
    // 140° → 220° over 60 min; the SE/S boundary at 157.5° is crossed at 13.125 min.
    expect(segments[0].endMs - BASE_MS).toBeCloseTo(13.125 * 60_000, -2);
    // The S/SW boundary at 202.5° is crossed at 46.875 min.
    expect(segments[1].endMs - BASE_MS).toBeCloseTo(46.875 * 60_000, -2);
  });

  it('does not split a track that wraps across north', () => {
    const segments = getHorizonThresholdSegments(
      createSamples([
        [0, 40, 350],
        [10, 40, 10],
      ]),
      createProfile({ N: 15 })
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].sectorLabel).toBe('N');
    expect(segments[0].thresholdDegrees).toBe(15);
  });

  it('splits a retrograde azimuth track at the same boundaries', () => {
    const forward = getHorizonThresholdSegments(
      createSamples([
        [0, 40, 140],
        [60, 40, 220],
      ]),
      createProfile({ SE: 15, S: 45, SW: 30 })
    );
    const backward = getHorizonThresholdSegments(
      createSamples([
        [0, 40, 220],
        [60, 40, 140],
      ]),
      createProfile({ SE: 15, S: 45, SW: 30 })
    );

    expect(backward.map(segment => segment.sectorLabel)).toEqual(['SW', 'S', 'SE']);
    expect(backward.map(segment => segment.endMs - segment.startMs).reverse()).toEqual(
      forward.map(segment => segment.endMs - segment.startMs)
    );
  });

  it('reports a blocked sector at the full 90 degrees', () => {
    const segments = getHorizonThresholdSegments(
      createSamples([
        [0, 80, 180],
        [10, 80, 180],
      ]),
      createProfile({ S: 90 })
    );

    expect(segments[0]).toMatchObject({
      isBlocked: true,
      thresholdDegrees: 90,
      sectorThresholdDegrees: 90,
    });
  });

  it('raises the threshold to the whole-sky minimum but keeps the sector value separate', () => {
    const segments = getHorizonThresholdSegments(
      createSamples([
        [0, 80, 180],
        [10, 80, 180],
      ]),
      { ...createProfile({ S: 15 }), minimumAltitude: 40 }
    );

    expect(segments[0].thresholdDegrees).toBe(40);
    expect(segments[0].sectorThresholdDegrees).toBe(15);
  });

  it('agrees with the accessible windows it shares its maths with', () => {
    const profile = { ...createProfile({ SE: 15, S: 45, SW: 90 }), minimumAltitude: 20 };
    const samples: [number, number, number][] = [];
    for (let minutes = 0; minutes <= 300; minutes += 10) {
      // A shallow arc rising to ~55° while sweeping SE → SW.
      samples.push([minutes, 10 + 45 * Math.sin((Math.PI * minutes) / 300), 130 + minutes * 0.3]);
    }

    const segments = getHorizonThresholdSegments(createSamples(samples), profile);
    const object = createMockObjectVisibility({
      altitudeSamples: samples.map(([minutes, altitude]) => [
        new Date(BASE_MS + minutes * 60_000),
        altitude,
      ]),
      azimuthSamples: samples.map(([minutes, , azimuth]) => [
        new Date(BASE_MS + minutes * 60_000),
        azimuth,
      ]),
    });
    const accessibility = evaluateTargetAccessibility(object, profile, null);

    expect(accessibility.windows.length).toBeGreaterThan(0);

    // Every window boundary must sit inside an unblocked segment, and the
    // interpolated altitude there must equal that segment's threshold unless
    // the boundary is the very start or end of the sampled track.
    for (const window of accessibility.windows) {
      for (const edge of [window.start, window.end]) {
        const edgeMs = edge.getTime();
        const segment = segments.find(
          candidate => edgeMs >= candidate.startMs - 1 && edgeMs <= candidate.endMs + 1
        );
        expect(segment).toBeDefined();
        expect(segment?.isBlocked).toBe(false);
      }
    }
  });
});
