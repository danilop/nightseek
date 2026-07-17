import * as Astronomy from 'astronomy-engine';
import type {
  DSOSubtype,
  NightInfo,
  ObjectCategory,
  ObjectVisibility,
  SaturnRingInfo,
} from '@/types';
import { calculateAirmass } from './airmass';
import { AU_TO_KM } from './constants';
import { calculateMoonlightInfo } from './moonlight';
import { calculateApparentDiameter, PLANET_DIAMETER_RANGES } from './planets';

function getAboveAltitudeSegment(
  startSample: [Date, number],
  endSample: [Date, number],
  threshold: number
): [number, number] | null {
  const [startTime, startAltitude] = startSample;
  const [endTime, endAltitude] = endSample;
  const startMs = startTime.getTime();
  const endMs = endTime.getTime();
  if (endMs <= startMs) return null;

  const startsAbove = startAltitude >= threshold;
  const endsAbove = endAltitude >= threshold;
  if (!startsAbove && !endsAbove) return null;
  if (startsAbove && endsAbove) return [startMs, endMs];

  const ratio = (threshold - startAltitude) / (endAltitude - startAltitude);
  const crossingMs = startMs + (endMs - startMs) * ratio;
  return startsAbove ? [startMs, crossingMs] : [crossingMs, endMs];
}

function appendOrMergeWindow(windows: [Date, Date][], segment: [number, number]): void {
  const previous = windows[windows.length - 1];
  if (previous && segment[0] <= previous[1].getTime() + 1) {
    previous[1] = new Date(Math.max(previous[1].getTime(), segment[1]));
    return;
  }
  windows.push([new Date(segment[0]), new Date(segment[1])]);
}

interface VisibilityOptions {
  magnitude?: number | null;
  subtype?: DSOSubtype | null;
  angularSizeArcmin?: number;
  minorAxisArcmin?: number;
  surfaceBrightness?: number | null;
  commonName?: string;
  isInterstellar?: boolean;
  constellation?: string;
  isMessier?: boolean;
  positionAtTime?: (time: Date) => { raHours: number; decDegrees: number };
}

function buildObjectMetadata(objectName: string, options: VisibilityOptions) {
  return {
    magnitude: options.magnitude ?? null,
    isInterstellar: options.isInterstellar ?? false,
    subtype: options.subtype ?? null,
    angularSizeArcmin: options.angularSizeArcmin ?? 0,
    minorAxisArcmin: options.minorAxisArcmin,
    surfaceBrightness: options.surfaceBrightness ?? null,
    commonName: options.commonName ?? objectName,
    constellation: options.constellation,
    isMessier: options.isMessier,
  };
}

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

/** Convert catalog coordinates from the J2000 mean equator to true equator-of-date. */
function equatorOfDateFromJ2000(
  raHours: number,
  decDegrees: number,
  time: Date
): { ra: number; dec: number } {
  const raRadians = (raHours * 15 * Math.PI) / 180;
  const decRadians = (decDegrees * Math.PI) / 180;
  const cosDec = Math.cos(decRadians);
  const vector = new Astronomy.Vector(
    cosDec * Math.cos(raRadians),
    cosDec * Math.sin(raRadians),
    Math.sin(decRadians),
    new Astronomy.AstroTime(time)
  );
  const ofDateVector = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(time), vector);
  const equator = Astronomy.EquatorFromVector(ofDateVector);
  return { ra: equator.ra, dec: equator.dec };
}

interface SolarObservingWindow {
  astronomicalNightMode: NightInfo['astronomicalNightMode'];
  observingWindowMode: NightInfo['observingWindowMode'];
  start: Date;
  end: Date;
}

function searchTwilightWindow(
  observer: Astronomy.Observer,
  date: Date,
  altitude: number
): [Date, Date] | null {
  const evening = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, date, 1, altitude);
  if (!evening) return null;
  const morning = Astronomy.SearchAltitude(
    Astronomy.Body.Sun,
    observer,
    +1,
    evening.date,
    1,
    altitude
  );
  return morning ? [evening.date, morning.date] : null;
}

function resolveSolarObservingWindow(
  observer: Astronomy.Observer,
  date: Date,
  nextDay: Date,
  sunset: Date | null,
  sunrise: Date | null,
  astronomicalWindow: [Date, Date] | null
): SolarObservingWindow {
  if (astronomicalWindow) {
    return {
      astronomicalNightMode: 'normal',
      observingWindowMode: 'astronomical',
      start: astronomicalWindow[0],
      end: astronomicalWindow[1],
    };
  }

  const brightestSunAltitude = Astronomy.SearchHourAngle(Astronomy.Body.Sun, observer, 0, date, +1)
    .hor.altitude;
  if (brightestSunAltitude <= -18) {
    return {
      astronomicalNightMode: 'continuous',
      observingWindowMode: 'continuous',
      start: date,
      end: nextDay,
    };
  }

  const nauticalWindow = searchTwilightWindow(observer, date, -12);
  if (nauticalWindow) {
    return {
      astronomicalNightMode: 'none',
      observingWindowMode: 'nautical',
      start: nauticalWindow[0],
      end: nauticalWindow[1],
    };
  }

  const civilWindow = searchTwilightWindow(observer, date, -6);
  if (civilWindow) {
    return {
      astronomicalNightMode: 'none',
      observingWindowMode: 'civil',
      start: civilWindow[0],
      end: civilWindow[1],
    };
  }

  if (sunset && sunrise) {
    return {
      astronomicalNightMode: 'none',
      observingWindowMode: 'sunset',
      start: sunset,
      end: sunrise,
    };
  }

  return {
    astronomicalNightMode: 'none',
    observingWindowMode: 'none',
    start: date,
    end: date,
  };
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

    // Get sunrise for next morning
    const nextDay = new Date(date.getTime() + 86_400_000);
    const sunriseSearch = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun,
      this.observer,
      +1,
      sunsetSearch?.date ?? date,
      1
    );

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
      duskSearch?.date ?? date,
      1,
      -18
    );

    const darkestEvent = Astronomy.SearchHourAngle(Astronomy.Body.Sun, this.observer, 12, date, +1);
    const minimumSunAltitude = darkestEvent.hor.altitude;
    const darkestTime = darkestEvent.time.date;

    const solarWindow = resolveSolarObservingWindow(
      this.observer,
      date,
      nextDay,
      sunsetSearch?.date ?? null,
      sunriseSearch?.date ?? null,
      duskSearch && dawnSearch ? [duskSearch.date, dawnSearch.date] : null
    );
    const { astronomicalNightMode, observingWindowMode } = solarWindow;
    const observingWindowStart = solarWindow.start;
    const observingWindowEnd = solarWindow.end;
    const astronomicalDusk = astronomicalNightMode === 'none' ? darkestTime : observingWindowStart;
    const astronomicalDawn = astronomicalNightMode === 'none' ? darkestTime : observingWindowEnd;
    const sunset = sunsetSearch?.date ?? date;
    const sunrise = sunriseSearch?.date ?? nextDay;

    // Moon phase and illumination at the midpoint of the actual analysis window.
    const midnight = new Date((observingWindowStart.getTime() + observingWindowEnd.getTime()) / 2);

    // MoonPhase returns 0-360 degrees where 0=new, 180=full
    const moonPhaseDegrees = Astronomy.MoonPhase(midnight);
    // Convert to 0-1 fraction where 0=new, 0.5=full, 1=new again
    const moonPhaseFraction = moonPhaseDegrees / 360;

    // Use the physical illuminated fraction, not a linear phase-angle approximation.
    const moonIlluminationPct =
      Astronomy.Illumination(Astronomy.Body.Moon, midnight).phase_fraction * 100;

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

    const nightInfo: NightInfo = {
      date,
      sunset,
      sunrise,
      astronomicalDusk,
      astronomicalDawn,
      sunsetOccurs: sunsetSearch !== null,
      sunriseOccurs: sunriseSearch !== null,
      astronomicalNightMode,
      observingWindowMode,
      observingWindowStart,
      observingWindowEnd,
      minimumSunAltitude,
      darkestTime,
      moonPhase: moonPhaseFraction,
      moonIllumination: moonIlluminationPct,
      moonRise: moonRiseSearch?.date ?? null,
      moonSet: moonSetSearch?.date ?? null,
      moonlight: {
        visibleHours: 0,
        visibleFraction: 0,
        maxAltitude: -90,
        exposurePercent: 0,
        level: 'none',
      },
      // New fields - populated by analyzer
      moonPhaseExact: null,
      localSiderealTimeAtMidnight: null,
      seeingForecast: null,
    };

    const moonSamples = this.sampleAltitudesForNight(time => {
      const position = this.getMoonPosition(time);
      return { altitude: position.altitude, azimuth: position.azimuth };
    }, nightInfo).altitudeSamples;
    nightInfo.moonlight = calculateMoonlightInfo(
      moonIlluminationPct,
      moonSamples,
      observingWindowStart,
      observingWindowEnd
    );

    return nightInfo;
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
    const equatorOfDate = equatorOfDateFromJ2000(raHours, decDeg, time);
    return this.getAltAzOfDate(equatorOfDate.ra, equatorOfDate.dec, time);
  }

  /** Convert equator-of-date coordinates to local horizontal coordinates. */
  private getAltAzOfDate(
    raHours: number,
    decDeg: number,
    time: Date
  ): { altitude: number; azimuth: number } {
    const horizon = Astronomy.Horizon(time, this.observer, raHours, decDeg, 'normal');

    return {
      altitude: horizon.altitude,
      azimuth: horizon.azimuth,
    };
  }

  /**
   * Get moon position at a given time
   */
  getMoonPosition(time: Date): { ra: number; dec: number; altitude: number; azimuth: number } {
    const moonEquator = Astronomy.Equator(Astronomy.Body.Moon, time, this.observer, false, true);
    const moonEquatorOfDate = Astronomy.Equator(
      Astronomy.Body.Moon,
      time,
      this.observer,
      true,
      true
    );
    const { altitude, azimuth } = this.getAltAzOfDate(
      moonEquatorOfDate.ra,
      moonEquatorOfDate.dec,
      time
    );

    return {
      ra: moonEquator.ra,
      dec: moonEquator.dec,
      altitude,
      azimuth,
    };
  }

  /**
   * Get sun position at a given time
   */
  getSunPosition(time: Date): { ra: number; dec: number } {
    const sunEquator = Astronomy.Equator(Astronomy.Body.Sun, time, this.observer, false, true);
    return {
      ra: sunEquator.ra,
      dec: sunEquator.dec,
    };
  }

  /** Get an apparent topocentric body position in the J2000 equatorial frame. */
  getBodyPositionJ2000(body: Astronomy.Body, time: Date): { ra: number; dec: number } {
    const equator = Astronomy.Equator(body, time, this.observer, false, true);
    return { ra: equator.ra, dec: equator.dec };
  }

  private getBodyPositionJ2000AtOptionalTime(
    body: Astronomy.Body,
    time: Date | null
  ): { ra: number; dec: number } | null {
    return time === null ? null : this.getBodyPositionJ2000(body, time);
  }

  private getBodyMoonSeparationAtOptionalTime(
    body: Astronomy.Body,
    time: Date | null
  ): number | null {
    if (time === null) return null;
    const equator = this.getBodyPositionJ2000(body, time);
    return this.getMoonSeparation(equator.ra, equator.dec, time);
  }

  private getMoonAltitudeAtOptionalTime(time: Date | null): number | null {
    return time === null ? null : this.getMoonPosition(time).altitude;
  }

  /**
   * Calculate moon separation from a celestial object
   */
  getMoonSeparation(raHours: number, decDeg: number, time: Date): number {
    const moonEquator = Astronomy.Equator(Astronomy.Body.Moon, time, this.observer, false, true);

    return angularSeparation(raHours * 15, decDeg, moonEquator.ra * 15, moonEquator.dec);
  }

  /**
   * Find window where object is above a given altitude
   */
  private findAltitudeWindow(samples: [Date, number][], threshold: number): [Date, Date] | null {
    const windows: [Date, Date][] = [];

    for (let index = 0; index < samples.length - 1; index++) {
      const segment = getAboveAltitudeSegment(samples[index], samples[index + 1], threshold);
      if (segment) appendOrMergeWindow(windows, segment);
    }

    let longestWindow: [Date, Date] | null = null;
    for (const window of windows) {
      if (
        longestWindow === null ||
        window[1].getTime() - window[0].getTime() >
          longestWindow[1].getTime() - longestWindow[0].getTime()
      ) {
        longestWindow = window;
      }
    }
    return longestWindow;
  }

  /**
   * Sample altitudes for an object throughout the night
   */
  private sampleAltitudesForNight(
    getAltitudeAt: (time: Date) => { altitude: number; azimuth: number },
    nightInfo: NightInfo
  ): {
    altitudeSamples: [Date, number][];
    azimuthSamples: [Date, number][];
    maxAltitude: number;
    maxAltitudeTime: Date | null;
    azimuthAtPeak: number;
  } {
    const altitudeSamples: [Date, number][] = [];
    const azimuthSamples: [Date, number][] = [];
    let maxAltitude = -90;
    let maxAltitudeTime: Date | null = null;
    let azimuthAtPeak = 0;

    if (nightInfo.observingWindowMode === 'none') {
      return { altitudeSamples, azimuthSamples, maxAltitude, maxAltitudeTime, azimuthAtPeak };
    }

    const startTime = nightInfo.observingWindowStart.getTime();
    const endTime = nightInfo.observingWindowEnd.getTime();
    const interval = 10 * 60 * 1000; // 10 minutes

    const sampleAt = (timeMs: number) => {
      const time = new Date(timeMs);
      const { altitude, azimuth } = getAltitudeAt(time);

      altitudeSamples.push([time, altitude]);
      azimuthSamples.push([time, azimuth]);

      if (altitude > maxAltitude) {
        maxAltitude = altitude;
        maxAltitudeTime = time;
        azimuthAtPeak = azimuth;
      }
    };

    for (let t = startTime; t < endTime; t += interval) {
      sampleAt(t);
    }
    if (endTime >= startTime) {
      sampleAt(endTime);
    }

    // The samples are deliberately coarse for charting and threshold-window
    // detection, but the displayed culmination time should not be rounded to
    // that grid. A three-point parabolic interpolation gives a precise peak
    // estimate with one additional ephemeris evaluation.
    const peakIndex = maxAltitudeTime
      ? altitudeSamples.findIndex(([time]) => time.getTime() === maxAltitudeTime?.getTime())
      : -1;
    if (peakIndex > 0 && peakIndex < altitudeSamples.length - 1) {
      const [previousTime, previousAltitude] = altitudeSamples[peakIndex - 1];
      const [sampledPeakTime, sampledPeakAltitude] = altitudeSamples[peakIndex];
      const [nextTime, nextAltitude] = altitudeSamples[peakIndex + 1];
      const previousSpacing = sampledPeakTime.getTime() - previousTime.getTime();
      const nextSpacing = nextTime.getTime() - sampledPeakTime.getTime();
      const denominator = previousAltitude - 2 * sampledPeakAltitude + nextAltitude;

      if (previousSpacing === nextSpacing && previousSpacing > 0 && denominator < -Number.EPSILON) {
        const sampleOffset = Math.max(
          -1,
          Math.min(1, 0.5 * ((previousAltitude - nextAltitude) / denominator))
        );
        const refinedTime = new Date(sampledPeakTime.getTime() + sampleOffset * previousSpacing);
        const refinedPosition = getAltitudeAt(refinedTime);
        if (refinedPosition.altitude >= maxAltitude) {
          maxAltitude = refinedPosition.altitude;
          maxAltitudeTime = refinedTime;
          azimuthAtPeak = refinedPosition.azimuth;
        }
      }
    }

    return { altitudeSamples, azimuthSamples, maxAltitude, maxAltitudeTime, azimuthAtPeak };
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
    options: VisibilityOptions = {}
  ): ObjectVisibility {
    const positionAtTime = options.positionAtTime ?? (() => ({ raHours, decDegrees: decDeg }));
    const { altitudeSamples, azimuthSamples, maxAltitude, maxAltitudeTime, azimuthAtPeak } =
      this.sampleAltitudesForNight(time => {
        const position = positionAtTime(time);
        return this.getAltAz(position.raHours, position.decDegrees, time);
      }, nightInfo);

    const windows = this.findAllAltitudeWindows(altitudeSamples);

    const peakPosition = maxAltitudeTime
      ? positionAtTime(maxAltitudeTime)
      : { raHours, decDegrees: decDeg };
    const moonSeparation = maxAltitudeTime
      ? this.getMoonSeparation(peakPosition.raHours, peakPosition.decDegrees, maxAltitudeTime)
      : null;
    const moonAltitudeAtPeak = this.getMoonAltitudeAtOptionalTime(maxAltitudeTime);

    return {
      objectName,
      objectType,
      // Visibility means the target rises during the selected usable observing
      // window. Darkness and imaging-quality cutoffs are evaluated separately.
      isVisible: maxAltitude >= 0,
      maxAltitude,
      maxAltitudeTime,
      above45Start: windows.above45?.[0] ?? null,
      above45End: windows.above45?.[1] ?? null,
      above60Start: windows.above60?.[0] ?? null,
      above60End: windows.above60?.[1] ?? null,
      above75Start: windows.above75?.[0] ?? null,
      above75End: windows.above75?.[1] ?? null,
      moonSeparation,
      moonAltitudeAtPeak,
      moonWarning:
        moonAltitudeAtPeak !== null &&
        moonAltitudeAtPeak > 0 &&
        moonSeparation !== null &&
        moonSeparation < 30,
      altitudeSamples,
      azimuthSamples,
      minAirmass: maxAltitude > 0 ? calculateAirmass(maxAltitude) : Infinity,
      azimuthAtPeak,
      raHours: peakPosition.raHours,
      decDegrees: peakPosition.decDegrees,
      ...buildObjectMetadata(objectName, options),
      apparentDiameterArcsec: null,
      apparentDiameterMin: null,
      apparentDiameterMax: null,
      positionAngle: null,
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

    const { altitudeSamples, azimuthSamples, maxAltitude, maxAltitudeTime, azimuthAtPeak } =
      this.sampleAltitudesForNight(time => {
        const equator = Astronomy.Equator(body, time, observer, true, true);
        return this.getAltAzOfDate(equator.ra, equator.dec, time);
      }, nightInfo);

    // Get magnitude and distance at peak
    if (maxAltitudeTime) {
      const illum = Astronomy.Illumination(body, maxAltitudeTime);
      const equator = Astronomy.Equator(body, maxAltitudeTime, observer, true, true);
      peakMagnitude = illum.mag;
      peakDistance = equator.dist * AU_TO_KM;
    }

    const peakPosition = this.getBodyPositionJ2000AtOptionalTime(body, maxAltitudeTime);

    const windows = this.findAllAltitudeWindows(altitudeSamples);

    const moonSeparation = this.getBodyMoonSeparationAtOptionalTime(body, maxAltitudeTime);
    const moonAltitudeAtPeak = this.getMoonAltitudeAtOptionalTime(maxAltitudeTime);

    const ranges = PLANET_DIAMETER_RANGES[planetName.toLowerCase()];
    const apparentDiameter = peakDistance
      ? calculateApparentDiameter(planetName, peakDistance)
      : null;

    const displayName = planetName.charAt(0).toUpperCase() + planetName.slice(1);

    return {
      objectName: displayName,
      objectType: 'planet',
      isVisible: maxAltitude >= 0,
      maxAltitude,
      maxAltitudeTime,
      above45Start: windows.above45?.[0] ?? null,
      above45End: windows.above45?.[1] ?? null,
      above60Start: windows.above60?.[0] ?? null,
      above60End: windows.above60?.[1] ?? null,
      above75Start: windows.above75?.[0] ?? null,
      above75End: windows.above75?.[1] ?? null,
      moonSeparation,
      moonAltitudeAtPeak,
      moonWarning:
        moonAltitudeAtPeak !== null &&
        moonAltitudeAtPeak > 0 &&
        moonSeparation !== null &&
        moonSeparation < 30,
      altitudeSamples,
      azimuthSamples,
      minAirmass: maxAltitude > 0 ? calculateAirmass(maxAltitude) : Infinity,
      azimuthAtPeak,
      raHours: peakPosition?.ra ?? 0,
      decDegrees: peakPosition?.dec ?? 0,
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
   * Sagittarius A* ICRS/J2000 position: RA 17h 45m 40.04s, Dec -29° 00′ 28.1″.
   * The compact radio source is used as a stable marker for the photographic core.
   */
  calculateGalacticCoreVisibility(nightInfo: NightInfo): ObjectVisibility {
    const milkyWayRA = 17.761122;
    const milkyWayDec = -29.007811;

    return this.calculateVisibility(
      milkyWayRA,
      milkyWayDec,
      nightInfo,
      'Galactic Core',
      'milky_way',
      {
        commonName: 'Galactic Core (Sagittarius A*)',
      }
    );
  }

  /**
   * Calculate Moon visibility (for display purposes)
   */
  calculateMoonVisibility(nightInfo: NightInfo): ObjectVisibility {
    if (nightInfo.observingWindowMode === 'none') {
      return {
        objectName: 'Moon',
        objectType: 'moon',
        isVisible: false,
        maxAltitude: -90,
        maxAltitudeTime: null,
        above45Start: null,
        above45End: null,
        above60Start: null,
        above60End: null,
        above75Start: null,
        above75End: null,
        moonSeparation: null,
        moonAltitudeAtPeak: null,
        moonWarning: false,
        altitudeSamples: [],
        azimuthSamples: [],
        minAirmass: Infinity,
        azimuthAtPeak: 0,
        raHours: 0,
        decDegrees: 0,
        magnitude: null,
        isInterstellar: false,
        subtype: null,
        angularSizeArcmin: 31,
        surfaceBrightness: null,
        commonName: 'Moon',
        apparentDiameterArcsec: 1860,
        apparentDiameterMin: 1760,
        apparentDiameterMax: 2010,
        positionAngle: null,
      };
    }

    const { altitudeSamples, azimuthSamples, maxAltitude, maxAltitudeTime, azimuthAtPeak } =
      this.sampleAltitudesForNight(time => {
        const pos = this.getMoonPosition(time);
        return { altitude: pos.altitude, azimuth: pos.azimuth };
      }, nightInfo);

    const peakPosition = this.getBodyPositionJ2000AtOptionalTime(
      Astronomy.Body.Moon,
      maxAltitudeTime
    );

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
      moonAltitudeAtPeak: null,
      moonWarning: false,
      altitudeSamples,
      azimuthSamples,
      minAirmass: maxAltitude > 0 ? calculateAirmass(maxAltitude) : Infinity,
      azimuthAtPeak,
      raHours: peakPosition?.ra ?? 0,
      decDegrees: peakPosition?.dec ?? 0,
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
  getHourAngleForRA(raHours: number, time: Date, decDegrees: number = 0): number {
    const equatorOfDate = equatorOfDateFromJ2000(raHours, decDegrees, time);
    const lst = Astronomy.SiderealTime(time) + this.observer.longitude / 15;
    let ha = lst - equatorOfDate.ra;

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
  getMeridianTransitTimeForRA(
    raHours: number,
    startTime: Date,
    decDegrees: number = 0
  ): Date | null {
    const equatorOfDate = equatorOfDateFromJ2000(raHours, decDegrees, startTime);
    // Calculate current LST
    const currentLst = Astronomy.SiderealTime(startTime) + this.observer.longitude / 15;

    // Time until RA is on meridian (LST = RA)
    let hoursUntilTransit = equatorOfDate.ra - currentLst;

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
