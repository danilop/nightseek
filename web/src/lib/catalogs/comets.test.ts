import { describe, expect, it } from 'vitest';
import { lightTimeCorrectedEquatorial } from '../astronomy/orbital-mechanics';
import type { ParsedComet } from './comets';
import { calculateCometPosition, isInterstellarDesignation, parseMPCCometLine } from './comets';

function comet(eccentricity: number): ParsedComet {
  return {
    designation: 'C/TEST',
    name: 'Test',
    perihelionDistance: 4.208024,
    eccentricity,
    inclination: 0,
    longitudeOfAscendingNode: 0,
    argumentOfPerihelion: 0,
    perihelionTime: 2460000,
    absoluteMagnitude: 10,
    slopeParameter: 4,
    isInterstellar: false,
    epochJD: 2460000,
  };
}

describe('comet conic propagation', () => {
  it.each([0.999995, 1, 1.000005])(
    'preserves perihelion distance for eccentricity %s',
    eccentricity => {
      const position = calculateCometPosition(comet(eccentricity), 2460000);
      expect(position.r).toBeCloseTo(4.208024, 8);
    }
  );

  it('moves outward symmetrically around a parabolic perihelion', () => {
    const before = calculateCometPosition(comet(1), 2460000 - 100);
    const after = calculateCometPosition(comet(1), 2460000 + 100);

    expect(before.r).toBeGreaterThan(4.208024);
    expect(after.r).toBeCloseTo(before.r, 10);
  });

  it('keeps a high-eccentricity interstellar trajectory finite far from perihelion', () => {
    const interstellar = comet(6.139884);
    const position = calculateCometPosition(interstellar, 2460000 + 300);

    expect(Number.isFinite(position.x)).toBe(true);
    expect(Number.isFinite(position.y)).toBe(true);
    expect(Number.isFinite(position.z)).toBe(true);
    expect(position.r).toBeGreaterThan(interstellar.perihelionDistance);
  });
});

describe('MPC comet parser', () => {
  it('parses the official spaced 3I/ATLAS perihelion date and removes the citation suffix', () => {
    const line =
      '0003I         2025 10 29.4825  1.356507  6.139884  128.0055  322.1535  175.1129  20251121  11.8  4.0  3I/ATLAS                                                 MPEC 2026-G41';
    const parsed = parseMPCCometLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed?.designation).toBe('3I');
    expect(parsed?.name).toBe('ATLAS');
    expect(parsed?.perihelionTime).toBeCloseTo(2460977.9825, 4);
    expect(parsed?.epochJD).toBeCloseTo(2461000.5, 4);
  });

  it('keeps the MPC two-body 3I solution close to JPL Horizons in July 2026', () => {
    const threeI: ParsedComet = {
      designation: '3I',
      name: 'ATLAS',
      perihelionDistance: 1.356507,
      eccentricity: 6.139884,
      inclination: 175.1129,
      longitudeOfAscendingNode: 322.1535,
      argumentOfPerihelion: 128.0055,
      perihelionTime: 2460977.9825,
      absoluteMagnitude: 11.8,
      slopeParameter: 4,
      isInterstellar: true,
      epochJD: 2461000.5,
    };
    const observation = new Date('2026-07-21T23:59:00Z');
    const observationJd = observation.getTime() / 86_400_000 + 2440587.5;
    const position = lightTimeCorrectedEquatorial(
      sampleJd => calculateCometPosition(threeI, sampleJd),
      observationJd
    );

    // JPL Horizons topocentric ICRF: 07:07:45.06, +19:49:20.6,
    // delta 10.402363 AU. The app intentionally uses a compact two-body MPC
    // model, so a few arcminutes and a few thousandths of an AU are allowed
    // for perturbations, non-gravitational acceleration, and parallax.
    expect(position.ra).toBeCloseTo(7.129183, 2);
    expect(position.dec).toBeCloseTo(19.822389, 1);
    expect(position.distance).toBeCloseTo(10.402363, 2);
  });
});

describe('interstellar classification', () => {
  it('uses the MPC I designation instead of osculating eccentricity', () => {
    expect(isInterstellarDesignation('1I')).toBe(true);
    expect(isInterstellarDesignation('2I/Borisov')).toBe(true);
    expect(isInterstellarDesignation('3I/ATLAS')).toBe(true);
    expect(isInterstellarDesignation('C/1999 J2')).toBe(false);
    expect(isInterstellarDesignation('C/2023 A3')).toBe(false);
  });
});
