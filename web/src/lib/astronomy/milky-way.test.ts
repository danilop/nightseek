import { describe, expect, it } from 'vitest';
import { createMockNightInfo } from '@/test/factories';
import { SkyCalculator } from './calculator';
import { calculateMilkyWayPlan, galacticToEquatorial } from './milky-way';

describe('galacticToEquatorial', () => {
  it('maps the Galactic coordinate origin to the IAU Galactic Centre direction', () => {
    const position = galacticToEquatorial(0, 0);

    expect(position.raHours).toBeCloseTo(17.76033, 4);
    expect(position.decDegrees).toBeCloseTo(-28.93617, 4);
  });

  it('maps the north Galactic pole to its J2000 equatorial position', () => {
    const position = galacticToEquatorial(0, 90);

    expect(position.raHours).toBeCloseTo(12.8573, 4);
    expect(position.decDegrees).toBeCloseTo(27.1283, 4);
  });
});

describe('calculateMilkyWayPlan', () => {
  it('samples the full band and both of its visible edges', () => {
    const calculator = new SkyCalculator(51.5074, -0.1278);
    const plan = calculateMilkyWayPlan(
      calculator,
      createMockNightInfo({
        observingWindowStart: new Date('2026-09-15T20:00:00Z'),
        observingWindowEnd: new Date('2026-09-16T04:00:00Z'),
      })
    );

    expect(plan.sections.length).toBeGreaterThanOrEqual(10);
    expect(plan.sections.every(section => section.samples.length === 3)).toBe(true);
    expect(plan.sections[0].samples.map(sample => sample.galacticLatitudeDeg)).toEqual([-5, 0, 5]);
    expect(
      plan.sections.every(section =>
        section.samples.every(sample => Number.isFinite(sample.visibility.maxAltitude))
      )
    ).toBe(true);
    expect(plan.coreVisibility.commonName).toContain('Sagittarius A*');
  });
});
