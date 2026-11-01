import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockNightForecast } from '@/test/factories';
import type { DSOCatalogEntry } from '@/types';
import { SkyCalculator } from '../astronomy/calculator';
import { calculateDSOVisibility } from '../astronomy/dso';
import { loadOpenNGCCatalog } from '../catalogs/opengc';
import { scoreTargetForNight } from '../scoring/target';
import { createDefaultHorizonProfile } from '../utils/horizon-profile';
import { getTargetRating } from '../utils/rating';
import { searchCelestialObjects } from './object-search';

vi.mock('../catalogs/opengc', () => ({ loadOpenNGCCatalog: vi.fn() }));
vi.mock('../catalogs/comets', async importOriginal => ({
  ...(await importOriginal<object>()),
  fetchComets: vi.fn().mockResolvedValue([]),
}));
const location = {
  name: 'London',
  latitude: 51.5074,
  longitude: -0.1278,
  timezone: 'Europe/London',
};
const now = new Date('2026-11-03T12:00:00Z');
const calculator = new SkyCalculator(location.latitude, location.longitude);
const nightInfo = calculator.getNightInfo(now);
const forecast = createMockNightForecast({ nightInfo, weather: null });
const dso: DSOCatalogEntry = {
  name: 'NGC 224',
  commonName: 'Andromeda Galaxy',
  messierNumber: 31,
  type: 'galaxy',
  raHours: 0.712,
  decDegrees: 41.269,
  magnitude: 3.4,
  majorAxisArcmin: 178,
  minorAxisArcmin: 63,
  surfaceBrightness: 23.5,
  constellation: 'And',
};
const fov = { width: 128, height: 72 };
beforeEach(() => vi.mocked(loadOpenNGCCatalog).mockResolvedValue([dso]));

describe('search and forecast consistency', () => {
  it('uses exactly the same score and visibility as the forecast, including after midnight', async () => {
    const target = scoreTargetForNight(
      calculateDSOVisibility(dso, calculator, nightInfo),
      nightInfo,
      null,
      calculator,
      forecast.astronomicalEvents,
      fov
    );
    const context = {
      forecasts: [forecast],
      scoredObjects: new Map([['2026-11-03', [target]]]),
      fov,
    };
    const [result] = await searchCelestialObjects(
      'M31',
      location,
      20,
      undefined,
      new Date('2026-11-04T01:00:00Z'),
      context
    );
    expect(result.visibleTonight).toBe(true);
    expect(result.nextVisibleDate).toEqual(nightInfo.date);
    expect(result.totalScore).toBe(target.totalScore);
    expect(result.visibility?.maxAltitude).toBe(target.visibility.maxAltitude);
  });
  it('scores objects outside the forecast magnitude limit through the same pipeline', async () => {
    const tiny = { ...dso, majorAxisArcmin: 2, minorAxisArcmin: 1, magnitude: 15 };
    vi.mocked(loadOpenNGCCatalog).mockResolvedValue([tiny]);
    const target = scoreTargetForNight(
      calculateDSOVisibility(tiny, calculator, nightInfo),
      nightInfo,
      null,
      calculator,
      forecast.astronomicalEvents,
      fov
    );
    const [result] = await searchCelestialObjects('M31', location, 20, undefined, now, {
      forecasts: [forecast],
      fov,
    });
    expect(result.totalScore).toBe(target.totalScore);
    expect(getTargetRating(result.totalScore ?? 0).stars).toBeLessThan(4);
    expect(result.visibility?.maxAltitude).toBeGreaterThan(75);
  });
  it('matches zero-padded NGC identifiers from the real catalog', async () => {
    vi.mocked(loadOpenNGCCatalog).mockResolvedValue([{ ...dso, name: 'NGC0224' }]);
    const [result] = await searchCelestialObjects('NGC 224', location, 20, undefined, now);
    expect(result.objectName).toBe('NGC0224');
  });
  it('does not invent an altitude-based rating without a forecast', async () => {
    const [result] = await searchCelestialObjects('M31', location, 20, undefined, now);
    expect(result.visibleTonight).toBe(true);
    expect(result.totalScore).toBeUndefined();
  });
  it('honours directional horizon blocks instead of a hard-coded 30-degree threshold', async () => {
    const profile = createDefaultHorizonProfile();
    profile.sectors = profile.sectors.map(s => ({ ...s, minAltitude: 90 }));
    const [result] = await searchCelestialObjects('M31', location, 20, undefined, now, {
      horizonProfile: profile,
    });
    expect(result.visibleTonight).toBe(false);
    expect(result.nextVisibleDate).toBeNull();
  });
  it('uses the forecast planetary calculator instead of separate coordinates', async () => {
    vi.mocked(loadOpenNGCCatalog).mockResolvedValue([]);
    const [result] = await searchCelestialObjects('Jupiter', location, 20, undefined, now);
    const expected = calculator.calculatePlanetVisibility('Jupiter', nightInfo);
    expect(result.raHours).toBe(expected.raHours);
    expect(result.visibility?.maxAltitude).toBe(expected.maxAltitude);
  });
});

describe('magnitude-filtered search', () => {
  it('filters before the result cap and excludes unknowns only for an active limit', async () => {
    const unknown = {
      ...dso,
      name: 'NGC 0001',
      commonName: 'Test unknown',
      messierNumber: null,
      magnitude: null,
    };
    const known = {
      ...dso,
      name: 'NGC 0002',
      commonName: 'Test known',
      messierNumber: null,
      magnitude: 5,
    };
    vi.mocked(loadOpenNGCCatalog).mockResolvedValue([unknown, known]);
    const filtered = await searchCelestialObjects('Test', location, 1, undefined, now, {
      magnitudeLimit: 20,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].magnitude).toBe(5);
    const all = await searchCelestialObjects('Test', location, 20, undefined, now);
    expect(all.map(item => item.magnitude)).toEqual(expect.arrayContaining([null, 5]));
  });
});
