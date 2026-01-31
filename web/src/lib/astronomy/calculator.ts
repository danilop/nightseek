import * as Astronomy from 'astronomy-engine';
import { calculateAirmass } from './airmass';
import { PLANET_DIAMETER_RANGES, calculateApparentDiameter } from './planets';
import type { NightInfo, ObjectVisibility, ObjectCategory, DSOSubtype } from '@/types';

/**
 * Calculate angular separation between two celestial objects
 * Uses Vincenty formula for accuracy
 */
export function angularSeparation(
  ra1: number, dec1: number,
  ra2: number, dec2: number
): number {
  const toRad = Math.PI / 180;

  const ra1Rad = ra1 * toRad;
  const dec1Rad = dec1 * toRad;
  const ra2Rad = ra2 * toRad;
  const dec2Rad = dec2 * toRad;

  const deltaRa = Math.abs(ra1Rad - ra2Rad);

  const numerator = Math.sqrt(
    Math.pow(Math.cos(dec2Rad) * Math.sin(deltaRa), 2) +
    Math.pow(
      Math.cos(dec1Rad) * Math.sin(dec2Rad) -
      Math.sin(dec1Rad) * Math.cos(dec2Rad) * Math.cos(deltaRa),
      2
    )
  );

  const denominator =
    Math.sin(dec1Rad) * Math.sin(dec2Rad) +
    Math.cos(dec1Rad) * Math.cos(dec2Rad) * Math.cos(deltaRa);

  return Math.atan2(numerator, denominator) / toRad;
}

export class SkyCalculator {
  private observer: Astronomy.Observer;

  constructor(latitude: number, longitude: number, elevation: number = 0) {
    this.observer = new Astronomy.Observer(latitude, longitude, elevation);
  }

  /**
   * Get night information for a given date
   */
  getNightInfo(date: Date): NightInfo {
    // Get sunset for this evening
    const sunsetSearch = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun, this.observer, -1, date, 1
    );
    const sunset = sunsetSearch?.date ?? date;

    // Get sunrise for next morning
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const sunriseSearch = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun, this.observer, +1, sunset, 1
    );
    const sunrise = sunriseSearch?.date ?? nextDay;

    // Astronomical twilight: Sun at -18 degrees
    const duskSearch = Astronomy.SearchAltitude(
      Astronomy.Body.Sun, this.observer, -1, date, 1, -18
    );
    const dawnSearch = Astronomy.SearchAltitude(
      Astronomy.Body.Sun, this.observer, +1, sunset, 1, -18
    );

    const astronomicalDusk = duskSearch?.date ?? sunset;
    const astronomicalDawn = dawnSearch?.date ?? sunrise;

    // Moon illumination at midnight
    const midnight = new Date(sunset);
    midnight.setHours(midnight.getHours() + 6);
    const moonIllum = Astronomy.Illumination(Astronomy.Body.Moon, midnight);

    // Moon rise/set
    const moonRiseSearch = Astronomy.SearchRiseSet(
      Astronomy.Body.Moon, this.observer, +1, sunset, 1
    );
    const moonSetSearch = Astronomy.SearchRiseSet(
      Astronomy.Body.Moon, this.observer, -1, sunset, 1
    );

    return {
      date,
      sunset,
      sunrise,
      astronomicalDusk,
      astronomicalDawn,
      moonPhase: moonIllum.phase_angle / 180,
      moonIllumination: moonIllum.phase_fraction * 100,
      moonRise: moonRiseSearch?.date ?? null,
      moonSet: moonSetSearch?.date ?? null,
    };
  }

  /**
   * Get altitude and azimuth for a celestial object
   */
  getAltAz(raHours: number, decDeg: number, time: Date): {
    altitude: number;
    azimuth: number;
  } {
    const horizon = Astronomy.Horizon(
      time, this.observer, raHours * 15, decDeg, 'normal'
    );

    return {
      altitude: horizon.altitude,
      azimuth: horizon.azimuth,
    };
  }

  /**
   * Get moon position at a given time
   */
  getMoonPosition(time: Date): { ra: number; dec: number; altitude: number; azimuth: number } {
    const moonEquator = Astronomy.Equator(
      Astronomy.Body.Moon, time, this.observer, true, true
    );
    const moonHorizon = Astronomy.Horizon(
      time, this.observer, moonEquator.ra * 15, moonEquator.dec, 'normal'
    );

    return {
      ra: moonEquator.ra,
      dec: moonEquator.dec,
      altitude: moonHorizon.altitude,
      azimuth: moonHorizon.azimuth,
    };
  }

  /**
   * Get sun position at a given time
   */
  getSunPosition(time: Date): { ra: number; dec: number } {
    const sunEquator = Astronomy.Equator(
      Astronomy.Body.Sun, time, this.observer, true, true
    );
    return {
      ra: sunEquator.ra,
      dec: sunEquator.dec,
    };
  }

  /**
   * Calculate moon separation from a celestial object
   */
  getMoonSeparation(raHours: number, decDeg: number, time: Date): number {
    const moonEquator = Astronomy.Equator(
      Astronomy.Body.Moon, time, this.observer, true, true
    );

    return angularSeparation(
      raHours * 15, decDeg,
      moonEquator.ra * 15, moonEquator.dec
    );
  }

  /**
   * Find window where object is above a given altitude
   */
  private findAltitudeWindow(
    samples: Array<[Date, number]>,
    threshold: number
  ): [Date, Date] | null {
    let start: Date | null = null;
    let end: Date | null = null;

    for (const [time, alt] of samples) {
      if (alt >= threshold) {
        if (!start) start = time;
        end = time;
      }
    }

    return start && end ? [start, end] : null;
  }

  /**
   * Calculate object visibility throughout the night
   */
  calculateVisibility(
    raHours: number,
    decDeg: number,
    nightInfo: NightInfo,
    objectName: string,
    objectType: ObjectCategory,
    options: {
      magnitude?: number | null;
      subtype?: DSOSubtype | null;
      angularSizeArcmin?: number;
      surfaceBrightness?: number | null;
      commonName?: string;
      isInterstellar?: boolean;
      constellation?: string;
      isMessier?: boolean;
    } = {}
  ): ObjectVisibility {
    const samples: Array<[Date, number]> = [];
    let maxAltitude = -90;
    let maxAltitudeTime: Date | null = null;
    let azimuthAtPeak = 0;

    // Sample every 10 minutes from dusk to dawn
    const startTime = nightInfo.astronomicalDusk.getTime();
    const endTime = nightInfo.astronomicalDawn.getTime();
    const interval = 10 * 60 * 1000; // 10 minutes

    for (let t = startTime; t <= endTime; t += interval) {
      const time = new Date(t);
      const { altitude, azimuth } = this.getAltAz(raHours, decDeg, time);

      samples.push([time, altitude]);

      if (altitude > maxAltitude) {
        maxAltitude = altitude;
        maxAltitudeTime = time;
        azimuthAtPeak = azimuth;
      }
    }

    // Find altitude threshold windows
    const above45 = this.findAltitudeWindow(samples, 45);
    const above60 = this.findAltitudeWindow(samples, 60);
    const above75 = this.findAltitudeWindow(samples, 75);

    // Calculate moon separation at peak
    const moonSeparation = maxAltitudeTime
      ? this.getMoonSeparation(raHours, decDeg, maxAltitudeTime)
      : null;

    return {
      objectName,
      objectType,
      isVisible: maxAltitude >= 30,
      maxAltitude,
      maxAltitudeTime,
      above45Start: above45?.[0] ?? null,
      above45End: above45?.[1] ?? null,
      above60Start: above60?.[0] ?? null,
      above60End: above60?.[1] ?? null,
      above75Start: above75?.[0] ?? null,
      above75End: above75?.[1] ?? null,
      moonSeparation,
      moonWarning: moonSeparation !== null && moonSeparation < 30,
      altitudeSamples: samples,
      minAirmass: maxAltitude > 0 ? calculateAirmass(maxAltitude) : Infinity,
      azimuthAtPeak,
      raHours,
      decDegrees: decDeg,
      magnitude: options.magnitude ?? null,
      isInterstellar: options.isInterstellar ?? false,
      subtype: options.subtype ?? null,
      angularSizeArcmin: options.angularSizeArcmin ?? 0,
      surfaceBrightness: options.surfaceBrightness ?? null,
      commonName: options.commonName ?? objectName,
      apparentDiameterArcsec: null,
      apparentDiameterMin: null,
      apparentDiameterMax: null,
      positionAngle: null,
      constellation: options.constellation,
      isMessier: options.isMessier,
    };
  }

  /**
   * Calculate planet visibility
   */
  calculatePlanetVisibility(
    planetName: string,
    nightInfo: NightInfo
  ): ObjectVisibility {
    const bodyMap: Record<string, Astronomy.Body> = {
      mercury: Astronomy.Body.Mercury,
      venus: Astronomy.Body.Venus,
      mars: Astronomy.Body.Mars,
      jupiter: Astronomy.Body.Jupiter,
      saturn: Astronomy.Body.Saturn,
      uranus: Astronomy.Body.Uranus,
      neptune: Astronomy.Body.Neptune,
    };

    const body = bodyMap[planetName.toLowerCase()];
    if (!body) {
      throw new Error(`Unknown planet: ${planetName}`);
    }

    const samples: Array<[Date, number]> = [];
    let maxAltitude = -90;
    let maxAltitudeTime: Date | null = null;
    let azimuthAtPeak = 0;
    let peakMagnitude: number | null = null;
    let peakDistance: number | null = null;

    const startTime = nightInfo.astronomicalDusk.getTime();
    const endTime = nightInfo.astronomicalDawn.getTime();
    const interval = 10 * 60 * 1000;

    for (let t = startTime; t <= endTime; t += interval) {
      const time = new Date(t);
      const equator = Astronomy.Equator(body, time, this.observer, true, true);
      const horizon = Astronomy.Horizon(
        time, this.observer, equator.ra * 15, equator.dec, 'normal'
      );

      samples.push([time, horizon.altitude]);

      if (horizon.altitude > maxAltitude) {
        maxAltitude = horizon.altitude;
        maxAltitudeTime = time;
        azimuthAtPeak = horizon.azimuth;

        // Get magnitude at peak
        const illum = Astronomy.Illumination(body, time);
        peakMagnitude = illum.mag;
        peakDistance = equator.dist * 149597870.7; // AU to km
      }
    }

    const above45 = this.findAltitudeWindow(samples, 45);
    const above60 = this.findAltitudeWindow(samples, 60);
    const above75 = this.findAltitudeWindow(samples, 75);

    const moonSeparation = maxAltitudeTime
      ? (() => {
          const equator = Astronomy.Equator(body, maxAltitudeTime, this.observer, true, true);
          return this.getMoonSeparation(equator.ra, equator.dec, maxAltitudeTime);
        })()
      : null;

    const ranges = PLANET_DIAMETER_RANGES[planetName.toLowerCase()];
    const apparentDiameter = peakDistance
      ? calculateApparentDiameter(planetName, peakDistance)
      : null;

    return {
      objectName: planetName.charAt(0).toUpperCase() + planetName.slice(1),
      objectType: 'planet',
      isVisible: maxAltitude >= 30,
      maxAltitude,
      maxAltitudeTime,
      above45Start: above45?.[0] ?? null,
      above45End: above45?.[1] ?? null,
      above60Start: above60?.[0] ?? null,
      above60End: above60?.[1] ?? null,
      above75Start: above75?.[0] ?? null,
      above75End: above75?.[1] ?? null,
      moonSeparation,
      moonWarning: moonSeparation !== null && moonSeparation < 30,
      altitudeSamples: samples,
      minAirmass: maxAltitude > 0 ? calculateAirmass(maxAltitude) : Infinity,
      azimuthAtPeak,
      raHours: 0,
      decDegrees: 0,
      magnitude: peakMagnitude,
      isInterstellar: false,
      subtype: null,
      angularSizeArcmin: apparentDiameter ? apparentDiameter / 60 : 0,
      surfaceBrightness: null,
      commonName: planetName.charAt(0).toUpperCase() + planetName.slice(1),
      apparentDiameterArcsec: apparentDiameter,
      apparentDiameterMin: ranges?.[0] ?? null,
      apparentDiameterMax: ranges?.[1] ?? null,
      positionAngle: null,
    };
  }

  /**
   * Calculate Milky Way core visibility
   * Galactic center: RA 17h 45m 40s, Dec -29.0 degrees
   */
  calculateMilkyWayVisibility(nightInfo: NightInfo): ObjectVisibility {
    const milkyWayRA = 17.761; // hours
    const milkyWayDec = -29.0; // degrees

    return this.calculateVisibility(
      milkyWayRA,
      milkyWayDec,
      nightInfo,
      'Milky Way Core',
      'milky_way',
      {
        commonName: 'Milky Way Core (Sagittarius A*)',
      }
    );
  }

  /**
   * Calculate Moon visibility (for display purposes)
   */
  calculateMoonVisibility(nightInfo: NightInfo): ObjectVisibility {
    const samples: Array<[Date, number]> = [];
    let maxAltitude = -90;
    let maxAltitudeTime: Date | null = null;
    let azimuthAtPeak = 0;

    const startTime = nightInfo.astronomicalDusk.getTime();
    const endTime = nightInfo.astronomicalDawn.getTime();
    const interval = 10 * 60 * 1000;

    for (let t = startTime; t <= endTime; t += interval) {
      const time = new Date(t);
      const pos = this.getMoonPosition(time);

      samples.push([time, pos.altitude]);

      if (pos.altitude > maxAltitude) {
        maxAltitude = pos.altitude;
        maxAltitudeTime = time;
        azimuthAtPeak = pos.azimuth;
      }
    }

    return {
      objectName: 'Moon',
      objectType: 'moon',
      isVisible: maxAltitude >= 0,
      maxAltitude,
      maxAltitudeTime,
      above45Start: null,
      above45End: null,
      above60Start: null,
      above60End: null,
      above75Start: null,
      above75End: null,
      moonSeparation: null,
      moonWarning: false,
      altitudeSamples: samples,
      minAirmass: maxAltitude > 0 ? calculateAirmass(maxAltitude) : Infinity,
      azimuthAtPeak,
      raHours: 0,
      decDegrees: 0,
      magnitude: null,
      isInterstellar: false,
      subtype: null,
      angularSizeArcmin: 31, // Average lunar diameter
      surfaceBrightness: null,
      commonName: 'Moon',
      apparentDiameterArcsec: 1860, // ~31 arcmin
      apparentDiameterMin: 1760,
      apparentDiameterMax: 2010,
      positionAngle: null,
    };
  }
}
