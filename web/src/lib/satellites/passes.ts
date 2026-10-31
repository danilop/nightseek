import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  type GeodeticLocation,
  gstime,
  jday,
  json2satrec,
  type LookAngles,
  propagate,
  radiansToDegrees,
  type SatRec,
  sunPos,
  twoline2satrec,
} from 'satellite.js';
import { getMinVisibleAltitudeForAzimuth } from '@/lib/utils/horizon-profile';
import type { HorizonProfile, Location, NightInfo, SatellitePass, TLEData } from '@/types';

// Minimum altitude to consider a pass visible (degrees)
const MIN_ALTITUDE_DEG = 10;

// Time step for pass search (seconds)
const TIME_STEP_SECONDS = 30;

/**
 * Approximate base (zenith) magnitudes for well-known satellites.
 * Keyed by NORAD ID.
 */
const SATELLITE_MAGNITUDES: Record<number, { magnitude: number; referenceRangeKm: number }> = {
  25544: { magnitude: -3.5, referenceRangeKm: 400 }, // ISS
  48274: { magnitude: -2.0, referenceRangeKm: 400 }, // Tiangong (CSS)
  20580: { magnitude: 1.5, referenceRangeKm: 540 }, // Hubble Space Telescope
};

/**
 * Maximum magnitude (dimmest) we include in results.
 * Anything dimmer than this is filtered out.
 */
const MAX_DISPLAY_MAGNITUDE = 3.0;

/**
 * Calculate satellite passes for given nights
 */
/* v8 ignore start */
export function calculateSatellitePasses(
  tle: TLEData,
  location: Location,
  nights: NightInfo[],
  horizonProfile?: HorizonProfile
): SatellitePass[] {
  const passes: SatellitePass[] = [];

  // Initialize satellite record from TLE
  const satrec = tle.omm ? json2satrec(tle.omm) : twoline2satrec(tle.line1, tle.line2);

  // Observer location
  const observerGd = {
    horizonProfile,
    longitude: degreesToRadians(location.longitude),
    latitude: degreesToRadians(location.latitude),
    height: 0, // kilometres above sea level (assume sea level)
  };

  const photometry = SATELLITE_MAGNITUDES[tle.noradId] ?? {
    magnitude: null,
    referenceRangeKm: 1000,
  };

  for (const night of nights) {
    // Bright satellites are useful in twilight too; per-sample darkness is checked below.
    const startTime = night.sunsetOccurs ? night.sunset : night.observingWindowStart;
    const endTime = night.sunriseOccurs ? night.sunrise : night.observingWindowEnd;

    const nightPasses = findPasses(
      satrec,
      observerGd,
      startTime,
      endTime,
      tle,
      photometry.magnitude,
      photometry.referenceRangeKm
    );
    passes.push(...nightPasses);
  }

  return passes;
}

/**
 * Calculate passes for multiple satellites and return sorted by time.
 * Filters to only include passes brighter than MAX_DISPLAY_MAGNITUDE.
 */
export function calculateMultiSatellitePasses(
  tles: TLEData[],
  location: Location,
  nights: NightInfo[],
  horizonProfile?: HorizonProfile
): SatellitePass[] {
  const allPasses: SatellitePass[] = [];

  for (const tle of tles) {
    try {
      const passes = calculateSatellitePasses(tle, location, nights, horizonProfile);
      allPasses.push(...passes);
    } catch {
      // Skip satellites that fail propagation (stale TLE, etc.)
    }
  }

  return allPasses
    .filter(pass => pass.magnitude === null || pass.magnitude <= MAX_DISPLAY_MAGNITUDE)
    .sort((a, b) => a.riseTime.getTime() - b.riseTime.getTime());
}

/**
 * Find all visible passes during a time window
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Pass tracking requires state machine logic
function findPasses(
  satrec: SatRec,
  observerGd: GeodeticLocation & { horizonProfile?: HorizonProfile },
  startTime: Date,
  endTime: Date,
  tle: TLEData,
  baseMagnitude: number | null,
  referenceRangeKm: number
): SatellitePass[] {
  const passes: SatellitePass[] = [];
  let currentPass: Partial<SatellitePass> | null = null;
  let maxAlt = 0;
  let rangeAtMax = referenceRangeKm;

  const startMs = startTime.getTime();
  const endMs = endTime.getTime();
  const midpoint = new Date((startMs + endMs) / 2);
  if (Math.abs(Number(jday(midpoint)) - satrec.jdsatepoch) > 14) return passes;
  let previousTime: Date | null = null;
  let previousVisible = false;

  for (let timeMs = startMs; timeMs <= endMs; timeMs += TIME_STEP_SECONDS * 1000) {
    const time = new Date(timeMs);
    const observation = getObservation(satrec, observerGd, time);
    const altitudeDeg = observation
      ? radiansToDegrees(observation.lookAngles.elevation)
      : Number.NEGATIVE_INFINITY;
    const azimuthDeg = observation ? radiansToDegrees(observation.lookAngles.azimuth) : 0;
    const isVisible = Boolean(
      observation &&
        altitudeDeg >= MIN_ALTITUDE_DEG &&
        observation.isSunlit &&
        observation.observerDark &&
        observation.clearHorizon
    );

    if (isVisible && observation) {
      // A visible segment requires both sufficient altitude and direct sunlight.
      if (currentPass) {
        // Update max altitude if this is higher
        if (altitudeDeg > maxAlt) {
          maxAlt = altitudeDeg;
          currentPass.maxAltitude = altitudeDeg;
          currentPass.maxTime = time;
          currentPass.maxAzimuth = normalizeAzimuth(azimuthDeg);
          rangeAtMax = observation.lookAngles.rangeSat;
        }
      } else {
        const riseTime =
          previousTime && !previousVisible
            ? refineVisibilityTransition(satrec, observerGd, previousTime, time)
            : time;
        const riseObservation = getObservation(satrec, observerGd, riseTime) ?? observation;
        // Start of a new pass
        currentPass = {
          elementEpoch: new Date((satrec.jdsatepoch - 2440587.5) * 86_400_000).toISOString(),
          satelliteName: tle.name,
          noradId: tle.noradId,
          riseTime,
          riseAzimuth: normalizeAzimuth(radiansToDegrees(riseObservation.lookAngles.azimuth)),
          maxAltitude: altitudeDeg,
          maxTime: time,
          maxAzimuth: normalizeAzimuth(azimuthDeg),
          isVisible: true,
        };
        maxAlt = altitudeDeg;
        rangeAtMax = observation.lookAngles.rangeSat;
      }
    } else if (currentPass) {
      const setTime =
        previousTime && previousVisible
          ? refineVisibilityTransition(satrec, observerGd, previousTime, time)
          : time;
      const setObservation = getObservation(satrec, observerGd, setTime);
      // End of pass (satellite dropped below threshold)
      currentPass.setTime = setTime;
      currentPass.setAzimuth = normalizeAzimuth(
        setObservation ? radiansToDegrees(setObservation.lookAngles.azimuth) : azimuthDeg
      );
      currentPass.duration = Math.round(
        (setTime.getTime() - (currentPass.riseTime?.getTime() ?? 0)) / 1000
      );

      // Estimate magnitude based on max altitude and satellite's base magnitude
      currentPass.magnitude =
        baseMagnitude === null
          ? null
          : estimateMagnitude(maxAlt, baseMagnitude, rangeAtMax, referenceRangeKm);

      passes.push(currentPass as SatellitePass);
      currentPass = null;
      maxAlt = 0;
    }
    previousTime = time;
    previousVisible = isVisible;
  }

  // Handle pass that extends beyond search window
  if (currentPass) {
    currentPass.setTime = endTime;
    currentPass.setAzimuth = currentPass.maxAzimuth; // Best estimate
    currentPass.duration = Math.round(
      (endTime.getTime() - (currentPass.riseTime?.getTime() ?? 0)) / 1000
    );
    currentPass.magnitude =
      baseMagnitude === null
        ? null
        : estimateMagnitude(maxAlt, baseMagnitude, rangeAtMax, referenceRangeKm);
    passes.push(currentPass as SatellitePass);
  }

  return passes;
}

function refineVisibilityTransition(
  satrec: SatRec,
  observerGd: GeodeticLocation & { horizonProfile?: HorizonProfile },
  firstTime: Date,
  secondTime: Date
): Date {
  let firstMs = firstTime.getTime();
  let secondMs = secondTime.getTime();
  const firstVisible = isVisibleAt(satrec, observerGd, firstTime);

  while (secondMs - firstMs > 1000) {
    const midpointMs = Math.floor((firstMs + secondMs) / 2);
    if (isVisibleAt(satrec, observerGd, new Date(midpointMs)) === firstVisible) {
      firstMs = midpointMs;
    } else {
      secondMs = midpointMs;
    }
  }
  return new Date(Math.round((firstMs + secondMs) / 2));
}

function isVisibleAt(
  satrec: SatRec,
  observerGd: GeodeticLocation & { horizonProfile?: HorizonProfile },
  time: Date
): boolean {
  const observation = getObservation(satrec, observerGd, time);
  return Boolean(
    observation &&
      radiansToDegrees(observation.lookAngles.elevation) >= MIN_ALTITUDE_DEG &&
      observation.isSunlit &&
      observation.observerDark &&
      observation.clearHorizon
  );
}

/**
 * Get look angles (azimuth, elevation, range) for a satellite at a given time
 */
function getObservation(
  satrec: SatRec,
  observerGd: GeodeticLocation & { horizonProfile?: HorizonProfile },
  time: Date
): {
  lookAngles: LookAngles;
  isSunlit: boolean;
  observerDark: boolean;
  clearHorizon: boolean;
} | null {
  const positionAndVelocity = propagate(satrec, time);

  if (
    !positionAndVelocity ||
    typeof positionAndVelocity.position === 'boolean' ||
    !positionAndVelocity.position
  ) {
    return null;
  }

  const gmst = gstime(time);
  const positionEcf = eciToEcf(positionAndVelocity.position, gmst);
  const lookAngles = ecfToLookAngles(observerGd, positionEcf);

  const sun = sunPos(jday(time)).rsun;
  const sunEcf = eciToEcf(
    { x: sun.x * 149597870.7, y: sun.y * 149597870.7, z: sun.z * 149597870.7 },
    gmst
  );
  const sunAltitude = radiansToDegrees(ecfToLookAngles(observerGd, sunEcf).elevation);
  const threshold = observerGd.horizonProfile
    ? getMinVisibleAltitudeForAzimuth(
        observerGd.horizonProfile,
        radiansToDegrees(lookAngles.azimuth)
      )
    : 0;
  return {
    lookAngles,
    isSunlit: isSatelliteSunlit(positionAndVelocity.position, time),
    observerDark: sunAltitude <= -6,
    clearHorizon: radiansToDegrees(lookAngles.elevation) >= threshold,
  };
}

/** Determine whether an Earth satellite is outside the Earth's umbral cone. */
export function isSatelliteSunlit(
  positionEciKm: { x: number; y: number; z: number },
  time: Date
): boolean {
  const sun = sunPos(jday(time)).rsun;
  const AU_KM = 149597870.7;
  const sunVector = { x: sun.x * AU_KM, y: sun.y * AU_KM, z: sun.z * AU_KM };
  const sunDistance = Math.hypot(sunVector.x, sunVector.y, sunVector.z);
  const sunUnit = {
    x: sunVector.x / sunDistance,
    y: sunVector.y / sunDistance,
    z: sunVector.z / sunDistance,
  };
  const projection =
    positionEciKm.x * sunUnit.x + positionEciKm.y * sunUnit.y + positionEciKm.z * sunUnit.z;

  if (projection >= 0) return true;

  const perpendicularDistance = Math.hypot(
    positionEciKm.x - projection * sunUnit.x,
    positionEciKm.y - projection * sunUnit.y,
    positionEciKm.z - projection * sunUnit.z
  );
  const EARTH_RADIUS_KM = 6378.137;
  const SUN_RADIUS_KM = 695700;
  const distanceBehindEarth = -projection;
  const umbraRadius =
    EARTH_RADIUS_KM - (distanceBehindEarth * (SUN_RADIUS_KM - EARTH_RADIUS_KM)) / sunDistance;

  return umbraRadius <= 0 || perpendicularDistance > umbraRadius;
}

/* v8 ignore stop */

/**
 * Normalize azimuth to 0-360 range
 */
export function normalizeAzimuth(azimuthDeg: number): number {
  let az = azimuthDeg % 360;
  if (az < 0) az += 360;
  return Math.round(az * 10) / 10;
}

/**
 * Estimate satellite magnitude based on altitude and base magnitude.
 * Higher altitude = brighter (closer to observer, better illumination angle).
 */
export function estimateMagnitude(
  altitudeDeg: number,
  baseMagnitude: number,
  rangeKm?: number,
  referenceRangeKm: number = 1000
): number {
  const rangeCorrection =
    rangeKm && rangeKm > 0
      ? 5 * Math.log10(rangeKm / referenceRangeKm)
      : ((90 - altitudeDeg) / 80) * 2;
  return Math.round((baseMagnitude + rangeCorrection) * 10) / 10;
}

/**
 * Format azimuth to compass direction
 */
export function azimuthToCompass(azimuth: number): string {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round(azimuth / 22.5) % 16;
  return directions[index];
}

/**
 * Format pass duration
 */
export function formatPassDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) {
    return `${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}
