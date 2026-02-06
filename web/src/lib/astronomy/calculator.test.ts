import * as Astronomy from 'astronomy-engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { angularSeparation, SkyCalculator } from './calculator';

describe('angularSeparation', () => {
  it('should return 0 for identical positions', () => {
    const result = angularSeparation(0, 0, 0, 0);
    expect(result).toBeCloseTo(0, 10);
  });

  it('should return 90 for perpendicular positions', () => {
    // North pole to equator at RA=0
    const result = angularSeparation(0, 90, 0, 0);
    expect(result).toBeCloseTo(90, 5);
  });

  it('should return 180 for opposite positions', () => {
    // North pole to south pole
    const result = angularSeparation(0, 90, 0, -90);
    expect(result).toBeCloseTo(180, 5);
  });

  it('should be symmetric', () => {
    const sep1 = angularSeparation(45, 30, 90, 60);
    const sep2 = angularSeparation(90, 60, 45, 30);
    expect(sep1).toBeCloseTo(sep2, 10);
  });

  it('should handle RA wrap-around', () => {
    // RA 350 and RA 10 are 20 degrees apart on the celestial equator
    const result = angularSeparation(350, 0, 10, 0);
    expect(result).toBeCloseTo(20, 5);
  });

  it('should calculate correct separation for known values', () => {
    // Vega (RA 18h 36m = 279°, Dec +38.8°) to Altair (RA 19h 50m = 297.5°, Dec +8.9°)
    // Angular separation is approximately 34 degrees
    const vega = { ra: 279, dec: 38.8 };
    const altair = { ra: 297.5, dec: 8.9 };

    const result = angularSeparation(vega.ra, vega.dec, altair.ra, altair.dec);
    expect(result).toBeGreaterThan(30);
    expect(result).toBeLessThan(40);
  });
});

describe('SkyCalculator', () => {
  let calculator: SkyCalculator;
  const latitude = 40.7128; // New York
  const longitude = -74.006;
  const elevation = 10;

  beforeEach(() => {
    calculator = new SkyCalculator(latitude, longitude, elevation);
  });

  describe('constructor', () => {
    it('should create calculator with given location', () => {
      expect(calculator.getLatitude()).toBe(latitude);
      expect(calculator.getLongitude()).toBe(longitude);
      expect(calculator.getElevation()).toBe(elevation);
    });

    it('should default elevation to 0', () => {
      const calcNoElev = new SkyCalculator(latitude, longitude);
      expect(calcNoElev.getElevation()).toBe(0);
    });
  });

  describe('getNightInfo', () => {
    it('should return night info with all required fields', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getNightInfo(testDate);

      expect(result).toHaveProperty('date');
      expect(result).toHaveProperty('sunset');
      expect(result).toHaveProperty('sunrise');
      expect(result).toHaveProperty('astronomicalDusk');
      expect(result).toHaveProperty('astronomicalDawn');
      expect(result).toHaveProperty('moonPhase');
      expect(result).toHaveProperty('moonIllumination');
    });

    it('should have sunset before sunrise', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getNightInfo(testDate);

      expect(result.sunset.getTime()).toBeLessThan(result.sunrise.getTime());
    });

    it('should have dusk before dawn', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getNightInfo(testDate);

      expect(result.astronomicalDusk.getTime()).toBeLessThan(result.astronomicalDawn.getTime());
    });

    it('should have moon phase between 0 and 1', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getNightInfo(testDate);

      expect(result.moonPhase).toBeGreaterThanOrEqual(0);
      expect(result.moonPhase).toBeLessThan(1);
    });

    it('should have moon illumination between 0 and 100', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getNightInfo(testDate);

      expect(result.moonIllumination).toBeGreaterThanOrEqual(0);
      expect(result.moonIllumination).toBeLessThanOrEqual(100);
    });
  });

  describe('getAltAz', () => {
    it('should return altitude and azimuth', () => {
      const testDate = new Date('2025-01-15T22:00:00Z');
      const result = calculator.getAltAz(12, 45, testDate);

      expect(result).toHaveProperty('altitude');
      expect(result).toHaveProperty('azimuth');
      expect(typeof result.altitude).toBe('number');
      expect(typeof result.azimuth).toBe('number');
    });

    it('should have altitude between -90 and 90', () => {
      const testDate = new Date('2025-01-15T22:00:00Z');
      const result = calculator.getAltAz(12, 45, testDate);

      expect(result.altitude).toBeGreaterThanOrEqual(-90);
      expect(result.altitude).toBeLessThanOrEqual(90);
    });

    it('should have azimuth between 0 and 360', () => {
      const testDate = new Date('2025-01-15T22:00:00Z');
      const result = calculator.getAltAz(12, 45, testDate);

      expect(result.azimuth).toBeGreaterThanOrEqual(0);
      expect(result.azimuth).toBeLessThanOrEqual(360);
    });
  });

  /**
   * Tests verified against independent sources:
   * - Sky Tonight planetarium (sky-tonight.com) for London, Feb 6, 2026
   * - Theoretical transit altitude formula: alt = 90 - |lat - dec|
   * - Polaris altitude ≈ observer latitude (fundamental astronomical property)
   *
   * These tests guard against RA/Dec unit conversion bugs (e.g. passing
   * degrees where hours are expected to astronomy-engine's Horizon function).
   */
  describe('getAltAz - verified against independent sources', () => {
    // London observer for all reference tests
    let london: SkyCalculator;
    beforeEach(() => {
      london = new SkyCalculator(51.5074, -0.1278, 0);
    });

    // Well-known object coordinates (J2000)
    const objects = {
      // Polaris: RA 2h 31m 49s, Dec +89° 15' 51"
      polaris: { ra: 2 + 31 / 60 + 49 / 3600, dec: 89 + 15 / 60 + 51 / 3600 },
      // M42 (Orion Nebula): RA 5h 35m 17s, Dec -5° 23' 28"
      m42: { ra: 5 + 35 / 60 + 17 / 3600, dec: -(5 + 23 / 60 + 28 / 3600) },
      // NGC 6543 (Cat's Eye): RA 17h 58m 33s, Dec +66° 37' 59"
      ngc6543: { ra: 17 + 58 / 60 + 33 / 3600, dec: 66 + 37 / 60 + 59 / 3600 },
      // Sirius: RA 6h 45m 9s, Dec -16° 42' 58"
      sirius: { ra: 6 + 45 / 60 + 9 / 3600, dec: -(16 + 42 / 60 + 58 / 3600) },
      // M45 (Pleiades): RA 3h 47m 0s, Dec +24° 7' 0"
      m45: { ra: 3 + 47 / 60, dec: 24 + 7 / 60 },
    };

    it('Polaris altitude should approximate observer latitude', () => {
      // Polaris is ~0.74° from the celestial pole, so its altitude
      // should always be within ~1° of the observer's latitude
      const time = new Date('2026-02-06T22:00:00Z');
      const result = london.getAltAz(objects.polaris.ra, objects.polaris.dec, time);

      expect(result.altitude).toBeCloseTo(51.5, 0); // within ~1°
    });

    it('Polaris altitude should remain nearly constant throughout the night', () => {
      const times = [
        new Date('2026-02-06T20:00:00Z'),
        new Date('2026-02-07T00:00:00Z'),
        new Date('2026-02-07T04:00:00Z'),
      ];
      const altitudes = times.map(
        t => london.getAltAz(objects.polaris.ra, objects.polaris.dec, t).altitude
      );

      // All altitudes should be within 1.5° of each other (circumpolar wobble)
      const min = Math.min(...altitudes);
      const max = Math.max(...altitudes);
      expect(max - min).toBeLessThan(1.5);
    });

    it('Polaris azimuth should always be near due North', () => {
      const time = new Date('2026-02-06T22:00:00Z');
      const result = london.getAltAz(objects.polaris.ra, objects.polaris.dec, time);

      // Azimuth should be near 0° (North) or 360°
      const distFromNorth = Math.min(result.azimuth, 360 - result.azimuth);
      expect(distFromNorth).toBeLessThan(3);
    });

    // Reference: Sky Tonight for London, Feb 6, 2026 at 20:30 UTC
    // M42: ~33° altitude, due South
    it('M42 should be ~33° altitude at 8:30 PM UTC from London (Sky Tonight reference)', () => {
      const time = new Date('2026-02-06T20:30:00Z');
      const result = london.getAltAz(objects.m42.ra, objects.m42.dec, time);

      expect(result.altitude).toBeCloseTo(33, 0); // within ~1°
      // Should be roughly south (azimuth 150-210°)
      expect(result.azimuth).toBeGreaterThan(150);
      expect(result.azimuth).toBeLessThan(210);
    });

    // The original bug case: NGC 6543 was showing 75° when it should be ~28°
    // NGC 6543 is circumpolar from London, near lower transit at ~8:30 PM in February
    // Reference: manual USNO calculation = 28.2°, DWARFlab app ~23°
    it('NGC 6543 should be ~28° at 8:30 PM UTC from London (not 75°)', () => {
      const time = new Date('2026-02-06T20:30:00Z');
      const result = london.getAltAz(objects.ngc6543.ra, objects.ngc6543.dec, time);

      expect(result.altitude).toBeCloseTo(28.2, 0); // within ~0.5°
      // Should be near due North (circumpolar object near lower transit)
      const distFromNorth = Math.min(result.azimuth, 360 - result.azimuth);
      expect(distFromNorth).toBeLessThan(10);
    });

    // Reference: Sky Tonight - Sirius ~20° altitude at 20:30 UTC
    it('Sirius should be ~20° altitude at 8:30 PM UTC from London (Sky Tonight reference)', () => {
      const time = new Date('2026-02-06T20:30:00Z');
      const result = london.getAltAz(objects.sirius.ra, objects.sirius.dec, time);

      expect(result.altitude).toBeCloseTo(20, 0); // within ~1°
    });

    // Reference: Sky Tonight - M45 ~55.4° altitude at 20:30 UTC
    it('M45 should be ~55° altitude at 8:30 PM UTC from London (Sky Tonight reference)', () => {
      const time = new Date('2026-02-06T20:30:00Z');
      const result = london.getAltAz(objects.m45.ra, objects.m45.dec, time);

      expect(result.altitude).toBeCloseTo(55.4, 0); // within ~0.5°
    });

    // Transit altitude is a pure geometric property: alt = 90° - |lat - dec|
    // This catches bugs where RA is wrong (shifts transit time) but dec is correct
    it('transit altitudes should match theoretical formula for all objects', () => {
      const lat = 51.5074;
      const testCases = [
        { name: 'M42', dec: objects.m42.dec, expected: 90 - Math.abs(lat - objects.m42.dec) },
        {
          name: 'Sirius',
          dec: objects.sirius.dec,
          expected: 90 - Math.abs(lat - objects.sirius.dec),
        },
        { name: 'M45', dec: objects.m45.dec, expected: 90 - Math.abs(lat - objects.m45.dec) },
        {
          name: 'NGC 6543',
          dec: objects.ngc6543.dec,
          expected: 90 - Math.abs(lat - objects.ngc6543.dec),
        },
      ];

      // Sample every 10 min across a full sidereal day to find the actual peak
      for (const tc of testCases) {
        let maxAlt = -90;
        const start = new Date('2026-02-06T12:00:00Z');
        for (let i = 0; i < 144; i++) {
          // 144 samples * 10 min = 24 hours
          const t = new Date(start.getTime() + i * 10 * 60 * 1000);
          const alt = london.getAltAz(
            tc.name === 'M42'
              ? objects.m42.ra
              : tc.name === 'Sirius'
                ? objects.sirius.ra
                : tc.name === 'M45'
                  ? objects.m45.ra
                  : objects.ngc6543.ra,
            tc.dec,
            t
          ).altitude;
          if (alt > maxAlt) maxAlt = alt;
        }
        expect(maxAlt).toBeCloseTo(tc.expected, 0);
      }
    });
  });

  describe('getAtmosphericRefraction', () => {
    it('should return positive refraction for positive altitude', () => {
      const result = calculator.getAtmosphericRefraction(30);
      expect(result).toBeGreaterThan(0);
    });

    it('should return larger refraction at lower altitudes', () => {
      const lowAlt = calculator.getAtmosphericRefraction(5);
      const highAlt = calculator.getAtmosphericRefraction(60);

      expect(lowAlt).toBeGreaterThan(highAlt);
    });

    it('should return approximately 34 arcmin at horizon', () => {
      const result = calculator.getAtmosphericRefraction(0);
      // Standard refraction at horizon is about 34 arcminutes = 0.567 degrees
      expect(result).toBeGreaterThan(0.4);
      expect(result).toBeLessThan(0.7);
    });

    it('should return 0 for objects well below horizon', () => {
      const result = calculator.getAtmosphericRefraction(-10);
      expect(result).toBe(0);
    });

    it('should return small refraction at zenith', () => {
      const result = calculator.getAtmosphericRefraction(90);
      // Refraction at zenith should be very small (close to 0)
      expect(result).toBeLessThan(0.1);
    });
  });

  describe('getApparentAltitude', () => {
    it('should return higher altitude than geometric', () => {
      const geometric = 30;
      const apparent = calculator.getApparentAltitude(geometric);

      expect(apparent).toBeGreaterThan(geometric);
    });

    it('should make objects above horizon appear higher', () => {
      const result = calculator.getApparentAltitude(0);
      // At geometric horizon, refraction makes objects appear higher
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('getHourAngle', () => {
    it('should return hour angle for a body', () => {
      const testDate = new Date('2025-01-15T22:00:00Z');
      const result = calculator.getHourAngle(Astronomy.Body.Jupiter, testDate);

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });
  });

  describe('getHourAngleForRA', () => {
    it('should return hour angle between 0 and 24', () => {
      const testDate = new Date('2025-01-15T22:00:00Z');
      const result = calculator.getHourAngleForRA(12, testDate);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(24);
    });

    it('should change throughout the day', () => {
      const date1 = new Date('2025-01-15T00:00:00Z');
      const date2 = new Date('2025-01-15T12:00:00Z');

      const ha1 = calculator.getHourAngleForRA(12, date1);
      const ha2 = calculator.getHourAngleForRA(12, date2);

      expect(ha1).not.toBeCloseTo(ha2, 1);
    });
  });

  describe('getMeridianTransitTime', () => {
    it('should return Date for valid body', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getMeridianTransitTime(Astronomy.Body.Jupiter, testDate);

      expect(result).toBeInstanceOf(Date);
    });

    it('should return transit time within 24 hours', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getMeridianTransitTime(Astronomy.Body.Mars, testDate);

      if (result) {
        const hoursDiff = Math.abs(result.getTime() - testDate.getTime()) / (60 * 60 * 1000);
        expect(hoursDiff).toBeLessThanOrEqual(24);
      }
    });

    it('should find transit when body is near meridian', () => {
      const testDate = new Date('2025-01-15T00:00:00Z');
      const result = calculator.getMeridianTransitTime(Astronomy.Body.Saturn, testDate);

      if (result) {
        // Hour angle at transit should be close to 0
        const haAtTransit = calculator.getHourAngle(Astronomy.Body.Saturn, result);
        // Hour angle 0 or 24 means on meridian
        expect(haAtTransit < 0.5 || haAtTransit > 23.5).toBe(true);
      }
    });
  });

  describe('getMeridianTransitTimeForRA', () => {
    it('should return a Date', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getMeridianTransitTimeForRA(12, testDate);

      expect(result).toBeInstanceOf(Date);
    });

    it('should be in the future from start time', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getMeridianTransitTimeForRA(12, testDate);

      if (result) {
        expect(result.getTime()).toBeGreaterThanOrEqual(testDate.getTime());
      }
    });
  });

  describe('getSunAngle', () => {
    it('should return angle between 0 and 180', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSunAngle(Astronomy.Body.Jupiter, testDate);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(180);
    });

    it('should return large angle for outer planets', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSunAngle(Astronomy.Body.Neptune, testDate);

      // Outer planets are usually far from the Sun
      expect(result).toBeGreaterThan(30);
    });

    it('should return smaller angle for inner planets near superior/inferior conjunction', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const mercuryAngle = calculator.getSunAngle(Astronomy.Body.Mercury, testDate);

      // Mercury is always within 28 degrees of the Sun
      expect(mercuryAngle).toBeLessThanOrEqual(30);
    });
  });

  describe('getSunAngleForPosition', () => {
    it('should return angle between 0 and 180', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSunAngleForPosition(12, 45, testDate);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(180);
    });

    it('should return 0 for position matching Sun', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const sunPos = calculator.getSunPosition(testDate);
      const result = calculator.getSunAngleForPosition(sunPos.ra, sunPos.dec, testDate);

      expect(result).toBeCloseTo(0, 1);
    });

    it('should change as position moves away from Sun', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const sunPos = calculator.getSunPosition(testDate);

      const nearSun = calculator.getSunAngleForPosition(sunPos.ra + 0.5, sunPos.dec, testDate);
      const farFromSun = calculator.getSunAngleForPosition(sunPos.ra + 6, sunPos.dec, testDate);

      expect(farFromSun).toBeGreaterThan(nearSun);
    });
  });

  describe('getHeliocentricDistance', () => {
    it('should return distance in AU', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getHeliocentricDistance(Astronomy.Body.Mars, testDate);

      expect(result).toBeGreaterThan(0);
      // Mars distance from Sun: 1.38 - 1.67 AU
      expect(result).toBeGreaterThan(1);
      expect(result).toBeLessThan(2);
    });

    it('should return ~1 AU for Earth', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getHeliocentricDistance(Astronomy.Body.Earth, testDate);

      expect(result).toBeCloseTo(1, 1);
    });

    it('should return larger distance for outer planets', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const mars = calculator.getHeliocentricDistance(Astronomy.Body.Mars, testDate);
      const jupiter = calculator.getHeliocentricDistance(Astronomy.Body.Jupiter, testDate);
      const saturn = calculator.getHeliocentricDistance(Astronomy.Body.Saturn, testDate);

      expect(jupiter).toBeGreaterThan(mars);
      expect(saturn).toBeGreaterThan(jupiter);
    });
  });

  describe('getGeocentricDistance', () => {
    it('should return distance in AU', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getGeocentricDistance(Astronomy.Body.Mars, testDate);

      expect(result).toBeGreaterThan(0);
    });

    it('should vary for Mars depending on orbit position', () => {
      // Mars distance from Earth: 0.37 - 2.68 AU
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getGeocentricDistance(Astronomy.Body.Mars, testDate);

      expect(result).toBeGreaterThan(0.3);
      expect(result).toBeLessThan(3);
    });

    it('should return very small distance for Moon', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getGeocentricDistance(Astronomy.Body.Moon, testDate);

      // Moon is about 0.00257 AU from Earth
      expect(result).toBeLessThan(0.01);
    });
  });

  describe('getSaturnRingInfo', () => {
    it('should return ring info structure', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSaturnRingInfo(testDate);

      expect(result).toHaveProperty('tiltAngle');
      expect(result).toHaveProperty('isNorthPoleVisible');
      expect(result).toHaveProperty('openness');
      expect(result).toHaveProperty('description');
    });

    it('should have tilt angle within Saturn ring range', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSaturnRingInfo(testDate);

      // Saturn rings tilt up to ~27 degrees
      expect(Math.abs(result.tiltAngle)).toBeLessThanOrEqual(28);
    });

    it('should have valid openness category', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSaturnRingInfo(testDate);

      expect(['edge-on', 'narrow', 'moderate', 'wide', 'maximum']).toContain(result.openness);
    });

    it('should have isNorthPoleVisible as boolean', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSaturnRingInfo(testDate);

      expect(typeof result.isNorthPoleVisible).toBe('boolean');
    });

    it('should match tilt sign with pole visibility', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSaturnRingInfo(testDate);

      // North pole visible when tilt > 0
      if (result.tiltAngle > 0) {
        expect(result.isNorthPoleVisible).toBe(true);
      } else if (result.tiltAngle < 0) {
        expect(result.isNorthPoleVisible).toBe(false);
      }
    });

    it('should have description matching openness', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSaturnRingInfo(testDate);

      expect(result.description.length).toBeGreaterThan(0);
      // Description should mention rings
      expect(result.description.toLowerCase()).toContain('ring');
    });
  });

  describe('getMoonPosition', () => {
    it('should return moon position with all fields', () => {
      const testDate = new Date('2025-01-15T22:00:00Z');
      const result = calculator.getMoonPosition(testDate);

      expect(result).toHaveProperty('ra');
      expect(result).toHaveProperty('dec');
      expect(result).toHaveProperty('altitude');
      expect(result).toHaveProperty('azimuth');
    });
  });

  describe('getSunPosition', () => {
    it('should return sun position', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSunPosition(testDate);

      expect(result).toHaveProperty('ra');
      expect(result).toHaveProperty('dec');
    });

    it('should have RA between 0 and 24', () => {
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSunPosition(testDate);

      expect(result.ra).toBeGreaterThanOrEqual(0);
      expect(result.ra).toBeLessThan(24);
    });

    it('should have Dec between -23.5 and 23.5', () => {
      // Sun declination is limited by Earth's axial tilt
      const testDate = new Date('2025-01-15T12:00:00Z');
      const result = calculator.getSunPosition(testDate);

      expect(result.dec).toBeGreaterThanOrEqual(-24);
      expect(result.dec).toBeLessThanOrEqual(24);
    });
  });

  describe('getMoonSeparation', () => {
    it('should return angular separation in degrees', () => {
      const testDate = new Date('2025-01-15T22:00:00Z');
      const result = calculator.getMoonSeparation(12, 45, testDate);

      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(180);
    });
  });

  describe('calculateVisibility', () => {
    it('should return visibility info', () => {
      const nightInfo = calculator.getNightInfo(new Date('2025-01-15T12:00:00Z'));
      const result = calculator.calculateVisibility(12, 45, nightInfo, 'Test Object', 'dso');

      expect(result).toHaveProperty('objectName');
      expect(result).toHaveProperty('objectType');
      expect(result).toHaveProperty('isVisible');
      expect(result).toHaveProperty('maxAltitude');
      expect(result).toHaveProperty('altitudeSamples');
    });

    it('should have altitude samples', () => {
      const nightInfo = calculator.getNightInfo(new Date('2025-01-15T12:00:00Z'));
      const result = calculator.calculateVisibility(12, 45, nightInfo, 'Test Object', 'dso');

      expect(Array.isArray(result.altitudeSamples)).toBe(true);
      expect(result.altitudeSamples.length).toBeGreaterThan(0);
    });
  });

  describe('calculatePlanetVisibility', () => {
    it('should return visibility for valid planet', () => {
      const nightInfo = calculator.getNightInfo(new Date('2025-01-15T12:00:00Z'));
      const result = calculator.calculatePlanetVisibility('jupiter', nightInfo);

      expect(result.objectName).toBe('Jupiter');
      expect(result.objectType).toBe('planet');
    });

    it('should throw for invalid planet', () => {
      const nightInfo = calculator.getNightInfo(new Date('2025-01-15T12:00:00Z'));

      expect(() => {
        calculator.calculatePlanetVisibility('pluto', nightInfo);
      }).toThrow('Unknown planet');
    });

    it('should have magnitude for planets', () => {
      const nightInfo = calculator.getNightInfo(new Date('2025-01-15T12:00:00Z'));
      const result = calculator.calculatePlanetVisibility('venus', nightInfo);

      expect(result.magnitude).not.toBeNull();
      // Venus is always very bright
      if (result.magnitude !== null) {
        expect(result.magnitude).toBeLessThan(0);
      }
    });
  });
});
