import * as Astronomy from 'astronomy-engine';
import type {
  DSOSubtype,
  NightInfo,
  ObjectCategory,
  ObjectVisibility,
  SaturnRingInfo,
} from '@/types';
import { calculateAirmass } from './airmass';
import { calculateApparentDiameter, PLANET_DIAMETER_RANGES } from './planets';

/**
 * Calculate angular separation between two celestial objects
 * Uses Vincenty formula for accuracy
 */
export function angularSeparation(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const toRad = Math.PI / 180;

  const ra1Rad = ra1 * toRad;
  const dec1Rad = dec1 * toRad;
  const ra2Rad = ra2 * toRad;
  const dec2Rad = dec2 * toRad;

  const deltaRa = Math.abs(ra1Rad - ra2Rad);

  const numerator = Math.sqrt(
    (Math.cos(dec2Rad) * Math.sin(deltaRa)) ** 2 +
      (Math.cos(dec1Rad) * Math.sin(dec2Rad) -
        Math.sin(dec1Rad) * Math.cos(dec2Rad) * Math.cos(deltaRa)) **
        2
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
    const sunsetSearch = Astronomy.SearchRiseSet(Astronomy.Body.Sun, this.observer, -1, date, 1);
    const sunset = sunsetSearch?.date ?? date;

    // Get sunrise for next morning
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    const sunriseSearch = Astronomy.SearchRiseSet(Astronomy.Body.Sun, this.observer, +1, sunset, 1);
    const sunrise = sunriseSearch?.date ?? nextDay;

    // Astronomical twilight: Sun at -18 degrees
    const duskSearch = Astronomy.SearchAltitude(
      Astronomy.Body.Sun,
      this.observer,
      -1,
      date,
      1,
      -18
    );
    const dawnSearch = Astronomy.SearchAltitude(
      Astronomy.Body.Sun,
      this.observer,
      +1,
      sunset,
      1,
      -18
    );

    const astronomicalDusk = duskSearch?.date ?? sunset;
    const astronomicalDawn = dawnSearch?.date ?? sunrise;

    // Moon phase and illumination at midnight
    const midnight = new Date(sunset);
    midnight.setHours(midnight.getHours() + 6);

    // MoonPhase returns 0-360 degrees where 0=new, 180=full
    const moonPhaseDegrees = Astronomy.MoonPhase(midnight);
    // Convert to 0-1 fraction where 0=new, 0.5=full, 1=new again
    const moonPhaseFraction = moonPhaseDegrees / 360;

    // Calculate illumination (0 at new, 100 at full)
    // Phase 0-180 is waxing (illumination increases), 180-360 is waning (decreases)
    let moonIlluminationPct: number;
    if (moonPhaseDegrees <= 180) {
      moonIlluminationPct = (moonPhaseDegrees / 180) * 100;
    } else {
      moonIlluminationPct = ((360 - moonPhaseDegrees) / 180) * 100;
    }

    // Moon rise/set
    const moonRiseSearch = Astronomy.SearchRiseSet(
      Astronomy.Body.Moon,
      this.observer,
      +1,
      sunset,
      1
    );
    const moonSetSearch = Astronomy.SearchRiseSet(
      Astronomy.Body.Moon,
      this.observer,
      -1,
      sunset,
      1
    );

    return {
      date,
      sunset,
      sunrise,
      astronomicalDusk,
      astronomicalDawn,
      moonPhase: moonPhaseFraction,
      moonIllumination: moonIlluminationPct,
      moonRise: moonRiseSearch?.date ?? null,
      moonSet: moonSetSearch?.date ?? null,
      // New fields - populated by analyzer
      moonPhaseExact: null,
      localSiderealTimeAtMidnight: null,
      seeingForecast: null,
    };
  }

  /**
   * Get altitude and azimuth for a celestial object
   */
  getAltAz(
    raHours: number,
    decDeg: number,
    time: Date
  ): {
    altitude: number;
    azimuth: number;
  } {
    const horizon = Astronomy.Horizon(time, this.observer, raHours * 15, decDeg, 'normal');

    return {
      altitude: horizon.altitude,
      azimuth: horizon.azimuth,
    };
  }

  /**
   * Get moon position at a given time
   */
  getMoonPosition(time: Date): { ra: number; dec: number; altitude: number; azimuth: number } {
    const moonEquator = Astronomy.Equator(Astronomy.Body.Moon, time, this.observer, true, true);
    const moonHorizon = Astronomy.Horizon(
      time,
      this.observer,
      moonEquator.ra * 15,
      moonEquator.dec,
      'normal'
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
    const sunEquator = Astronomy.Equator(Astronomy.Body.Sun, time, this.observer, true, true);
    return {
      ra: sunEquator.ra,
      dec: sunEquator.dec,
    };
  }

  /**
   * Calculate moon separation from a celestial object
   */
  getMoonSeparation(raHours: number, decDeg: number, time: Date): number {
    const moonEquator = Astronomy.Equator(Astronomy.Body.Moon, time, this.observer, true, true);

    return angularSeparation(raHours * 15, decDeg, moonEquator.ra * 15, moonEquator.dec);
  }

  /**
   * Find window where object is above a given altitude
   */
  private findAltitudeWindow(samples: [Date, number][], threshold: number): [Date, Date] | null {
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
   * Sample altitudes for an object throughout the night
   */
  private sampleAltitudesForNight(
    getAltitudeAt: (time: Date) => { altitude: number; azimuth: number },
    nightInfo: NightInfo
  ): {
    samples: [Date, number][];
    maxAltitude: number;
    maxAltitudeTime: Date | null;
    azimuthAtPeak: number;
  } {
    const samples: [Date, number][] = [];
    let maxAltitude = -90;
    let maxAltitudeTime: Date | null = null;
    let azimuthAtPeak = 0;

    const startTime = nightInfo.astronomicalDusk.getTime();
    const endTime = nightInfo.astronomicalDawn.getTime();
    const interval = 10 * 60 * 1000; // 10 minutes

    for (let t = startTime; t <= endTime; t += interval) {
      const time = new Date(t);
      const { altitude, azimuth } = getAltitudeAt(time);

      samples.push([time, altitude]);

      if (altitude > maxAltitude) {
        maxAltitude = altitude;
        maxAltitudeTime = time;
        azimuthAtPeak = azimuth;
      }
    }

    return { samples, maxAltitude, maxAltitudeTime, azimuthAtPeak };
  }

  /**
   * Find all altitude threshold windows
   */
  private findAllAltitudeWindows(samples: [Date, number][]): {
    above45: [Date, Date] | null;
    above60: [Date, Date] | null;
    above75: [Date, Date] | null;
  } {
    return {
      above45: this.findAltitudeWindow(samples, 45),
      above60: this.findAltitudeWindow(samples, 60),
      above75: this.findAltitudeWindow(samples, 75),
    };
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
    const { samples, maxAltitude, maxAltitudeTime, azimuthAtPeak } = this.sampleAltitudesForNight(
      time => this.getAltAz(raHours, decDeg, time),
      nightInfo
    );

    const windows = this.findAllAltitudeWindows(samples);

    const moonSeparation = maxAltitudeTime
      ? this.getMoonSeparation(raHours, decDeg, maxAltitudeTime)
      : null;

    return {
      objectName,
      objectType,
      isVisible: maxAltitude >= 30,
      maxAltitude,
      maxAltitudeTime,
      above45Start: windows.above45?.[0] ?? null,
      above45End: windows.above45?.[1] ?? null,
      above60Start: windows.above60?.[0] ?? null,
      above60End: windows.above60?.[1] ?? null,
      above75Start: windows.above75?.[0] ?? null,
      above75End: windows.above75?.[1] ?? null,
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
   * Get planet body from name
   */
  private getPlanetBody(planetName: string): Astronomy.Body {
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
    return body;
  }

  /**
   * Calculate planet visibility
   */
  calculatePlanetVisibility(planetName: string, nightInfo: NightInfo): ObjectVisibility {
    const body = this.getPlanetBody(planetName);
    const observer = this.observer;

    let peakMagnitude: number | null = null;
    let peakDistance: number | null = null;

    const { samples, maxAltitude, maxAltitudeTime, azimuthAtPeak } = this.sampleAltitudesForNight(
      time => {
        const equator = Astronomy.Equator(body, time, observer, true, true);
        const horizon = Astronomy.Horizon(time, observer, equator.ra * 15, equator.dec, 'normal');
        return { altitude: horizon.altitude, azimuth: horizon.azimuth };
      },
      nightInfo
    );

    // Get magnitude and distance at peak
    if (maxAltitudeTime) {
      const illum = Astronomy.Illumination(body, maxAltitudeTime);
      const equator = Astronomy.Equator(body, maxAltitudeTime, observer, true, true);
      peakMagnitude = illum.mag;
      peakDistance = equator.dist * 149597870.7; // AU to km
    }

    const windows = this.findAllAltitudeWindows(samples);

    const moonSeparation = maxAltitudeTime
      ? (() => {
          const equator = Astronomy.Equator(body, maxAltitudeTime, observer, true, true);
          return this.getMoonSeparation(equator.ra, equator.dec, maxAltitudeTime);
        })()
      : null;

    const ranges = PLANET_DIAMETER_RANGES[planetName.toLowerCase()];
    const apparentDiameter = peakDistance
      ? calculateApparentDiameter(planetName, peakDistance)
      : null;

    const displayName = planetName.charAt(0).toUpperCase() + planetName.slice(1);

    return {
      objectName: displayName,
      objectType: 'planet',
      isVisible: maxAltitude >= 30,
      maxAltitude,
      maxAltitudeTime,
      above45Start: windows.above45?.[0] ?? null,
      above45End: windows.above45?.[1] ?? null,
      above60Start: windows.above60?.[0] ?? null,
      above60End: windows.above60?.[1] ?? null,
      above75Start: windows.above75?.[0] ?? null,
      above75End: windows.above75?.[1] ?? null,
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
      commonName: displayName,
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
    const samples: [Date, number][] = [];
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

  /**
   * Get the observer's latitude for external calculations
   */
  getLatitude(): number {
    return this.observer.latitude;
  }

  /**
   * Get the observer's longitude for external calculations
   */
  getLongitude(): number {
    return this.observer.longitude;
  }

  /**
   * Get the observer's elevation for external calculations
   */
  getElevation(): number {
    return this.observer.height;
  }

  /**
   * Calculate atmospheric refraction correction
   * Returns the refraction in degrees to add to geometric altitude
   *
   * Uses astronomy-engine's Refraction and Atmosphere functions
   */
  getAtmosphericRefraction(geometricAltitude: number): number {
    if (geometricAltitude < -2) {
      return 0; // Below horizon, no meaningful refraction
    }

    // Get atmospheric model for our elevation
    const atm = Astronomy.Atmosphere(this.observer.height);

    // Get refraction angle
    const refraction = Astronomy.Refraction('normal', geometricAltitude);

    // Apply atmospheric density correction
    return refraction * atm.density;
  }

  /**
   * Get apparent altitude after applying atmospheric refraction
   * This gives more accurate rise/set times
   */
  getApparentAltitude(geometricAltitude: number): number {
    const refraction = this.getAtmosphericRefraction(geometricAltitude);
    return geometricAltitude + refraction;
  }

  /**
   * Calculate hour angle for a body at a given time
   *
   * Hour angle is the time since the object crossed the meridian:
   * - 0 hours = on meridian (best viewing)
   * - 6 hours = setting in west
   * - 12 hours = opposite side (below horizon for most objects)
   * - 18 hours = rising in east
   */
  getHourAngle(body: Astronomy.Body, time: Date): number {
    return Astronomy.HourAngle(body, time, this.observer);
  }

  /**
   * Calculate hour angle for a fixed RA position
   * Uses sidereal time calculation
   */
  getHourAngleForRA(raHours: number, time: Date): number {
    const lst = Astronomy.SiderealTime(time) + this.observer.longitude / 15;
    let ha = lst - raHours;

    // Normalize to 0-24 hours
    while (ha < 0) ha += 24;
    while (ha >= 24) ha -= 24;

    return ha;
  }

  /**
   * Search for when a body crosses the meridian (hour angle = 0)
   *
   * @param body The celestial body to search for
   * @param startTime Start time for search
   * @param direction +1 for next meridian crossing, -1 for previous
   */
  getMeridianTransitTime(
    body: Astronomy.Body,
    startTime: Date,
    direction: number = 1
  ): Date | null {
    try {
      // SearchHourAngle finds when body reaches specified hour angle
      const result = Astronomy.SearchHourAngle(body, this.observer, 0, startTime, direction);
      return result?.time.date ?? null;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Estimate meridian transit time for a fixed RA position
   * This is when the object is highest in the sky
   */
  getMeridianTransitTimeForRA(raHours: number, startTime: Date): Date | null {
    // Calculate current LST
    const currentLst = Astronomy.SiderealTime(startTime) + this.observer.longitude / 15;

    // Time until RA is on meridian (LST = RA)
    let hoursUntilTransit = raHours - currentLst;

    // Adjust for next occurrence
    if (hoursUntilTransit < 0) hoursUntilTransit += 24;
    if (hoursUntilTransit > 24) hoursUntilTransit -= 24;

    // Convert sidereal hours to solar hours
    const solarHours = hoursUntilTransit / 1.00274; // Sidereal to solar conversion

    const transitTime = new Date(startTime);
    transitTime.setTime(transitTime.getTime() + solarHours * 60 * 60 * 1000);

    return transitTime;
  }

  /**
   * Calculate angular distance of a body from the Sun
   * Useful for determining twilight visibility
   *
   * Returns angle in degrees (0-180)
   */
  getSunAngle(body: Astronomy.Body, time: Date): number {
    return Astronomy.AngleFromSun(body, time);
  }

  /**
   * Calculate sun angle for a fixed position (RA/Dec)
   */
  getSunAngleForPosition(raHours: number, decDeg: number, time: Date): number {
    const sunPos = this.getSunPosition(time);

    return angularSeparation(raHours * 15, decDeg, sunPos.ra * 15, sunPos.dec);
  }

  /**
   * Get heliocentric distance of a body (distance from Sun)
   */
  getHeliocentricDistance(body: Astronomy.Body, time: Date): number {
    return Astronomy.HelioDistance(body, time);
  }

  /**
   * Get geocentric distance of a body (distance from Earth)
   */
  getGeocentricDistance(body: Astronomy.Body, time: Date): number {
    const vector = Astronomy.GeoVector(body, time, true);
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  }

  /**
   * Get Saturn ring information
   * Uses the ring_tilt property from Illumination
   */
  getSaturnRingInfo(time: Date): SaturnRingInfo {
    const illum = Astronomy.Illumination(Astronomy.Body.Saturn, time);
    const tiltAngle = illum.ring_tilt ?? 0;

    // Determine openness based on tilt
    // Saturn's rings can tilt up to ~27 degrees
    const absTilt = Math.abs(tiltAngle);
    let openness: SaturnRingInfo['openness'];
    let description: string;

    if (absTilt < 3) {
      openness = 'edge-on';
      description = 'Rings nearly edge-on (difficult to see)';
    } else if (absTilt < 10) {
      openness = 'narrow';
      description = 'Rings narrow opening';
    } else if (absTilt < 18) {
      openness = 'moderate';
      description = 'Rings moderately open';
    } else if (absTilt < 24) {
      openness = 'wide';
      description = 'Rings wide open (excellent visibility)';
    } else {
      openness = 'maximum';
      description = 'Rings at maximum tilt (best visibility)';
    }

    return {
      tiltAngle: Math.round(tiltAngle * 10) / 10,
      isNorthPoleVisible: tiltAngle > 0,
      openness,
      description,
    };
  }
}
