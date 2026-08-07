import { describe, expect, it } from 'vitest';
import {
  fractionToTime,
  getTwilightBands,
  getTwilightBoundaries,
  getTwilightGradientCss,
  getTwilightPhaseAtFraction,
  getTwilightWindowLabel,
  nightFraction,
  TWILIGHT_PHASES,
} from '@/lib/astronomy/twilight';
import { createMockNightInfo } from '@/test/factories';

const SUNSET = new Date('2025-01-15T17:00:00Z');
const SUNRISE = new Date('2025-01-16T07:00:00Z');

/** Sunset 17:00, sunrise 07:00 — a 14-hour domain with 1-hour = 1/14. */
function hoursAfterSunset(hours: number): Date {
  return new Date(SUNSET.getTime() + hours * 3_600_000);
}

function baseNight(overrides = {}) {
  return createMockNightInfo({
    sunset: SUNSET,
    sunrise: SUNRISE,
    astronomicalDusk: hoursAfterSunset(1.5),
    astronomicalDawn: hoursAfterSunset(12.5),
    ...overrides,
  });
}

describe('nightFraction / fractionToTime', () => {
  it('maps a time to its position in the sunset→sunrise span', () => {
    expect(nightFraction(hoursAfterSunset(7), SUNSET, SUNRISE)).toBeCloseTo(0.5, 10);
  });

  it('clamps times outside the span', () => {
    expect(nightFraction(new Date(SUNSET.getTime() - 3_600_000), SUNSET, SUNRISE)).toBe(0);
    expect(nightFraction(new Date(SUNRISE.getTime() + 3_600_000), SUNSET, SUNRISE)).toBe(1);
  });

  it('returns 0 for an inverted or zero-length span', () => {
    expect(nightFraction(SUNSET, SUNRISE, SUNSET)).toBe(0);
  });

  it('round-trips through fractionToTime', () => {
    const time = fractionToTime(0.25, SUNSET, SUNRISE);
    expect(nightFraction(time, SUNSET, SUNRISE)).toBeCloseTo(0.25, 10);
  });
});

describe('getTwilightBoundaries', () => {
  it('uses real −6°/−12° times when the ephemeris found them', () => {
    const boundaries = getTwilightBoundaries(
      baseNight({
        civilDusk: hoursAfterSunset(0.4),
        nauticalDusk: hoursAfterSunset(0.9),
        nauticalDawn: hoursAfterSunset(13.1),
        civilDawn: hoursAfterSunset(13.6),
      })
    );

    expect(boundaries.isApproximate).toBe(false);
    expect(boundaries.civilDuskFraction).toBeCloseTo(0.4 / 14, 10);
    expect(boundaries.nauticalDuskFraction).toBeCloseTo(0.9 / 14, 10);
    expect(boundaries.nauticalDawnFraction).toBeCloseTo(13.1 / 14, 10);
    expect(boundaries.civilDawnFraction).toBeCloseTo(13.6 / 14, 10);
  });

  it('falls back to equal thirds when the real times are missing', () => {
    const boundaries = getTwilightBoundaries(baseNight());
    const duskFraction = 1.5 / 14;
    const dawnFraction = 12.5 / 14;

    expect(boundaries.isApproximate).toBe(true);
    expect(boundaries.civilDuskFraction).toBeCloseTo(duskFraction / 3, 10);
    expect(boundaries.nauticalDuskFraction).toBeCloseTo((duskFraction * 2) / 3, 10);
    expect(boundaries.nauticalDawnFraction).toBeCloseTo(dawnFraction + (1 - dawnFraction) / 3, 10);
    expect(boundaries.civilDawnFraction).toBeCloseTo(
      dawnFraction + ((1 - dawnFraction) * 2) / 3,
      10
    );
  });

  it('flags approximation when only one boundary is missing', () => {
    const boundaries = getTwilightBoundaries(
      baseNight({
        civilDusk: hoursAfterSunset(0.4),
        nauticalDusk: hoursAfterSunset(0.9),
        nauticalDawn: hoursAfterSunset(13.1),
      })
    );
    expect(boundaries.isApproximate).toBe(true);
  });

  it('returns six ascending fractions inside [0, 1]', () => {
    const boundaries = getTwilightBoundaries(
      baseNight({
        civilDusk: hoursAfterSunset(0.4),
        nauticalDusk: hoursAfterSunset(0.9),
        nauticalDawn: hoursAfterSunset(13.1),
        civilDawn: hoursAfterSunset(13.6),
      })
    );
    const values = [
      boundaries.civilDuskFraction,
      boundaries.nauticalDuskFraction,
      boundaries.astronomicalDuskFraction,
      boundaries.astronomicalDawnFraction,
      boundaries.nauticalDawnFraction,
      boundaries.civilDawnFraction,
    ];

    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    for (let index = 1; index < values.length; index++) {
      expect(values[index]).toBeGreaterThanOrEqual(values[index - 1]);
    }
  });

  it('clamps monotonically when real times fall outside the sunset→sunrise domain', () => {
    // A high-latitude night where the -6 search lands before sunset and the
    // -12 search lands after the astronomical dusk it should precede.
    const boundaries = getTwilightBoundaries(
      baseNight({
        civilDusk: new Date(SUNSET.getTime() - 7_200_000),
        nauticalDusk: hoursAfterSunset(4),
        nauticalDawn: hoursAfterSunset(11),
        civilDawn: new Date(SUNRISE.getTime() + 7_200_000),
      })
    );

    expect(boundaries.civilDuskFraction).toBe(0);
    // Clamped up to the astronomical dusk it may not precede.
    expect(boundaries.astronomicalDuskFraction).toBeGreaterThanOrEqual(
      boundaries.nauticalDuskFraction
    );
    expect(boundaries.nauticalDawnFraction).toBeGreaterThanOrEqual(
      boundaries.astronomicalDawnFraction
    );
    expect(boundaries.civilDawnFraction).toBe(1);
  });

  it('treats continuous darkness as a single night band', () => {
    const boundaries = getTwilightBoundaries(
      createMockNightInfo({ astronomicalNightMode: 'continuous' })
    );
    const bands = getTwilightBands(boundaries);

    expect(boundaries.isApproximate).toBe(false);
    expect(bands).toEqual([{ startFraction: 0, endFraction: 1, phase: 'night', reverse: false }]);
  });
});

describe('getTwilightBands', () => {
  it('covers [0, 1] contiguously without overlaps', () => {
    const bands = getTwilightBands(getTwilightBoundaries(baseNight()));

    expect(bands[0].startFraction).toBe(0);
    expect(bands[bands.length - 1].endFraction).toBe(1);
    for (let index = 1; index < bands.length; index++) {
      expect(bands[index].startFraction).toBeCloseTo(bands[index - 1].endFraction, 10);
    }
  });

  it('emits seven bands on a normal night, ending brightest on both sides', () => {
    const bands = getTwilightBands(getTwilightBoundaries(baseNight()));

    expect(bands.map(band => band.phase)).toEqual([
      'civil',
      'nautical',
      'astronomical',
      'night',
      'astronomical',
      'nautical',
      'civil',
    ]);
    expect(bands.slice(4).every(band => band.reverse)).toBe(true);
  });

  it('drops the night band when there is no astronomical darkness', () => {
    // astronomicalDusk === astronomicalDawn === darkestTime for mode 'none'.
    const darkest = hoursAfterSunset(7);
    const bands = getTwilightBands(
      getTwilightBoundaries(
        baseNight({
          astronomicalNightMode: 'none',
          observingWindowMode: 'nautical',
          astronomicalDusk: darkest,
          astronomicalDawn: darkest,
          nauticalDusk: hoursAfterSunset(2),
          nauticalDawn: hoursAfterSunset(12),
          civilDusk: hoursAfterSunset(1),
          civilDawn: hoursAfterSunset(13),
        })
      )
    );

    expect(bands.some(band => band.phase === 'night')).toBe(false);
    expect(bands.filter(band => band.phase === 'astronomical')).toHaveLength(2);
  });
});

describe('getTwilightGradientCss', () => {
  it('places the four phase colours at the boundary fractions', () => {
    const boundaries = getTwilightBoundaries(baseNight());
    const gradient = getTwilightGradientCss(boundaries);

    expect(gradient).toContain(`${TWILIGHT_PHASES.civil.color} 0%`);
    expect(gradient).toContain(`${TWILIGHT_PHASES.civil.color} 100%`);
    expect(gradient).toContain(
      `${TWILIGHT_PHASES.nautical.color} ${boundaries.civilDuskFraction * 100}%`
    );
    expect(gradient).toContain(
      `${TWILIGHT_PHASES.night.color} ${boundaries.astronomicalDuskFraction * 100}%`
    );
  });
});

describe('getTwilightPhaseAtFraction', () => {
  it('reports astronomical night at the middle of a normal night', () => {
    const result = getTwilightPhaseAtFraction(0.5, getTwilightBoundaries(baseNight()));

    expect(result.phase.label).toBe('Astronomical Night');
    expect(result.sunAltitudeLabel).toMatch(/^\d+° below horizon$/);
  });

  it('deepens the reported Sun altitude towards the middle of the night', () => {
    const boundaries = getTwilightBoundaries(baseNight());
    const middle = getTwilightPhaseAtFraction(0.5, boundaries);
    const edge = getTwilightPhaseAtFraction(boundaries.astronomicalDuskFraction, boundaries);

    expect(Number.parseInt(middle.sunAltitudeLabel, 10)).toBeGreaterThan(
      Number.parseInt(edge.sunAltitudeLabel, 10)
    );
  });

  it('reports civil twilight just after sunset and just before sunrise', () => {
    const boundaries = getTwilightBoundaries(baseNight());

    expect(getTwilightPhaseAtFraction(0, boundaries).phase.label).toBe('Civil Twilight');
    expect(getTwilightPhaseAtFraction(1, boundaries).phase.label).toBe('Civil Twilight');
  });

  it('runs the Sun depth backwards on the dawn side', () => {
    const boundaries = getTwilightBoundaries(baseNight());
    const justBeforeSunrise = getTwilightPhaseAtFraction(0.999, boundaries);

    expect(justBeforeSunrise.phase.id).toBe('civil');
    expect(Number.parseInt(justBeforeSunrise.sunAltitudeLabel, 10)).toBeLessThanOrEqual(1);
  });
});

describe('getTwilightWindowLabel', () => {
  it('names the darkest window a night reaches', () => {
    expect(getTwilightWindowLabel('nautical')).toBe('Astronomical twilight window');
    expect(getTwilightWindowLabel('civil')).toBe('Nautical twilight window');
    expect(getTwilightWindowLabel('sunset')).toBe('Civil twilight window');
    expect(getTwilightWindowLabel('none')).toBe('No usable twilight window');
  });
});
