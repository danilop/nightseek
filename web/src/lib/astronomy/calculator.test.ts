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
