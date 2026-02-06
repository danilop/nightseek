import { describe, expect, it } from 'vitest';
import { getConstellation, getConstellationFullName, getConstellationInfo } from './constellations';

describe('getConstellationFullName', () => {
  it('should convert known abbreviations', () => {
    expect(getConstellationFullName('Ori')).toBe('Orion');
    expect(getConstellationFullName('Dra')).toBe('Draco');
    expect(getConstellationFullName('UMa')).toBe('Ursa Major');
  });

  it('should return original string for unknown abbreviation', () => {
    expect(getConstellationFullName('XYZ')).toBe('XYZ');
  });
});

/**
 * Tests verified against IAU constellation boundaries.
 * These guard against RA unit bugs (Astronomy.Constellation expects hours, not degrees).
 */
describe('getConstellation - verified against IAU boundaries', () => {
  // Well-known objects with unambiguous constellation membership
  // RA values are in hours as expected by the function signature

  it("NGC 6543 (Cat's Eye Nebula) should be in Draco", () => {
    // RA 17h 58m 33s, Dec +66° 37' 59"
    const ra = 17 + 58 / 60 + 33 / 3600;
    const dec = 66 + 37 / 60 + 59 / 3600;
    expect(getConstellation(ra, dec)).toBe('Draco');
  });

  it('M42 (Orion Nebula) should be in Orion', () => {
    // RA 5h 35m 17s, Dec -5° 23' 28"
    const ra = 5 + 35 / 60 + 17 / 3600;
    const dec = -(5 + 23 / 60 + 28 / 3600);
    expect(getConstellation(ra, dec)).toBe('Orion');
  });

  it('M31 (Andromeda Galaxy) should be in Andromeda', () => {
    // RA 0h 42m 44s, Dec +41° 16' 9"
    const ra = 0 + 42 / 60 + 44 / 3600;
    const dec = 41 + 16 / 60 + 9 / 3600;
    expect(getConstellation(ra, dec)).toBe('Andromeda');
  });

  it('Polaris should be in Ursa Minor', () => {
    // RA 2h 31m 49s, Dec +89° 15' 51"
    const ra = 2 + 31 / 60 + 49 / 3600;
    const dec = 89 + 15 / 60 + 51 / 3600;
    expect(getConstellation(ra, dec)).toBe('Ursa Minor');
  });

  it('Sirius should be in Canis Major', () => {
    // RA 6h 45m 9s, Dec -16° 42' 58"
    const ra = 6 + 45 / 60 + 9 / 3600;
    const dec = -(16 + 42 / 60 + 58 / 3600);
    expect(getConstellation(ra, dec)).toBe('Canis Major');
  });

  it('M45 (Pleiades) should be in Taurus', () => {
    // RA 3h 47m 0s, Dec +24° 7' 0"
    const ra = 3 + 47 / 60;
    const dec = 24 + 7 / 60;
    expect(getConstellation(ra, dec)).toBe('Taurus');
  });

  it('Galactic center (Sgr A*) should be in Sagittarius', () => {
    // RA 17h 45m 40s, Dec -29° 0' 28"
    const ra = 17 + 45 / 60 + 40 / 3600;
    const dec = -(29 + 0 / 60 + 28 / 3600);
    expect(getConstellation(ra, dec)).toBe('Sagittarius');
  });
});

describe('getConstellationInfo', () => {
  it('should return name and symbol for NGC 6543', () => {
    const ra = 17 + 58 / 60 + 33 / 3600;
    const dec = 66 + 37 / 60 + 59 / 3600;
    const info = getConstellationInfo(ra, dec);

    expect(info.name).toBe('Draco');
    expect(info.symbol).toBe('Dra');
  });

  it('should return name and symbol for M42', () => {
    const ra = 5 + 35 / 60 + 17 / 3600;
    const dec = -(5 + 23 / 60 + 28 / 3600);
    const info = getConstellationInfo(ra, dec);

    expect(info.name).toBe('Orion');
    expect(info.symbol).toBe('Ori');
  });
});
