import * as Astronomy from 'astronomy-engine';
import { describe, expect, it } from 'vitest';
import {
  calculateMinorPlanetMagnitude,
  calculateMinorPlanetPosition,
  DWARF_PLANETS,
  NOTABLE_ASTEROIDS,
} from './minor-planets';

describe('minor-planet ephemerides', () => {
  it('uses the validated planetary ephemeris for Pluto', () => {
    const date = new Date('2026-07-16T00:00:00Z');
    const jd = date.getTime() / 86400000 + 2440587.5;
    const pluto = DWARF_PLANETS.find(body => body.name === 'Pluto');
    expect(pluto).toBeDefined();
    if (!pluto) throw new Error('Pluto fixture is missing');
    const position = calculateMinorPlanetPosition(pluto, jd);
    const expected = Astronomy.EquatorFromVector(
      Astronomy.GeoVector(Astronomy.Body.Pluto, date, true)
    );

    expect(position.ra).toBeCloseTo(expected.ra, 10);
    expect(position.dec).toBeCloseTo(expected.dec, 10);
  });

  it('stores refreshed JPL osculating elements for the tracked asteroids', () => {
    expect(NOTABLE_ASTEROIDS.every(body => body.epochJD === 2461200.5)).toBe(true);
  });

  it('agrees with JPL Horizons for Ceres after light-time correction', () => {
    // Horizons geocentric ICRF observer ephemeris, 2026-07-16 00:00 UTC:
    // RA 78.270079573°, Dec +21.090624255° (JPL solution #48 / DE441).
    const ceres = DWARF_PLANETS.find(body => body.name === 'Ceres');
    if (!ceres) throw new Error('Ceres fixture is missing');
    const position = calculateMinorPlanetPosition(ceres, 2461237.5);

    expect(Math.abs(position.ra * 15 - 78.270079573)).toBeLessThan(0.001);
    expect(Math.abs(position.dec - 21.090624255)).toBeLessThan(0.001);
  });

  it('uses measured JPL H-G slope parameters when available', () => {
    expect(DWARF_PLANETS.find(body => body.name === 'Ceres')?.slopeParameter).toBe(0.12);
    expect(NOTABLE_ASTEROIDS.find(body => body.name === 'Vesta')?.slopeParameter).toBe(0.32);
    expect(NOTABLE_ASTEROIDS.find(body => body.name === 'Pallas')?.slopeParameter).toBe(0.11);
    expect(NOTABLE_ASTEROIDS.find(body => body.name === 'Juno')?.slopeParameter).toBe(0.32);
  });
});

describe('H-G asteroid magnitude', () => {
  it('dims an asteroid at non-zero phase angle', () => {
    const atOpposition = calculateMinorPlanetMagnitude(3.2, 2.4, 1.4, 0);
    const atThirtyDegrees = calculateMinorPlanetMagnitude(3.2, 2.4, 1.4, 30);

    expect(atThirtyDegrees).toBeGreaterThan(atOpposition);
  });
});
