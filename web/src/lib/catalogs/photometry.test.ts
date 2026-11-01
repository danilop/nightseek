import { describe, expect, it } from 'vitest';
import harris from '@/data/harris-magnitudes.json';
import { resolveCatalogMagnitude } from './photometry';

const cluster = harris.clusters.NGC6541;
const ra = cluster.raDegrees / 15;
const dec = cluster.decDegrees;
describe('whole-object catalogue photometry', () => {
  it('fills an unknown cluster with integrated V, not horizontal-branch star magnitude', () => {
    const result = resolveCatalogMagnitude('NGC 6541', 'globular_cluster', null, ra, dec, null);
    expect(result.magnitude).toBe(6.3);
    expect(result.source).toContain('Harris 1996 (2010 edition)');
    expect(result.source).toContain('integrated V');
    expect(resolveCatalogMagnitude('NGC06541', 'globular_cluster', null, ra, dec, null)).toEqual(
      result
    );
  });
  it('preserves primary measurements for other classes, including zero and band', () => {
    expect(resolveCatalogMagnitude('NGC6541', 'galaxy', 0, ra, dec, 'B')).toEqual({
      magnitude: 0,
      source: 'OpenNGC · B band',
    });
  });
  it('rejects component identifiers, other object types and spatial mismatches', () => {
    expect(
      resolveCatalogMagnitude('NGC654 1', 'globular_cluster', null, ra, dec, null).magnitude
    ).toBeNull();
    expect(
      resolveCatalogMagnitude('NGC6541', 'planetary_nebula', null, ra, dec, null).magnitude
    ).toBeNull();
    expect(
      resolveCatalogMagnitude('NGC6541', 'globular_cluster', null, ra, dec + 0.1, null).magnitude
    ).toBeNull();
    expect(
      resolveCatalogMagnitude('NGC6541', 'globular_cluster', null, NaN, dec, null).magnitude
    ).toBeNull();
  });
  it('keeps the bundled subset finite and independently spot-checks integrated values', () => {
    expect(Object.keys(harris.clusters)).toHaveLength(107);
    expect(harris.clusters.NGC104.vMagnitude).toBe(3.95);
    expect(harris.clusters.NGC6637.vMagnitude).toBe(7.64);
    for (const value of Object.values(harris.clusters)) {
      expect(Number.isFinite(value.vMagnitude)).toBe(true);
      expect(value.raDegrees).toBeGreaterThanOrEqual(0);
      expect(value.raDegrees).toBeLessThan(360);
    }
  });
});

it('prefers dedicated integrated cluster photometry when the general catalogue disagrees', () => {
  const m10 = harris.clusters.NGC6254;
  expect(
    resolveCatalogMagnitude(
      'NGC6254',
      'globular_cluster',
      4.98,
      m10.raDegrees / 15,
      m10.decDegrees,
      'V'
    ).magnitude
  ).toBe(6.6);
});
