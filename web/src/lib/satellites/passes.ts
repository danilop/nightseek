import * as satellite from 'satellite.js';
import type { Location, NightInfo, SatellitePass, TLEData } from '@/types';

// Default magnitude at zenith when no specific value is known
const DEFAULT_BASE_MAGNITUDE = -1.0;

// Minimum altitude to consider a pass visible (degrees)
const MIN_ALTITUDE_DEG = 10;

// Time step for pass search (seconds)
const TIME_STEP_SECONDS = 30;

/**
 * Approximate base (zenith) magnitudes for well-known satellites.
 * Keyed by NORAD ID.
 */
const SATELLITE_MAGNITUDES: Record<number, number> = {
  25544: -3.5, // ISS
  48274: -2.0, // Tiangong (CSS)
  20580: 1.5, // Hubble Space Telescope
};

/**
 * Maximum magnitude (dimmest) we include in results.
 * Anything dimmer than this is filtered out.
 */
const MAX_DISPLAY_MAGNITUDE = 3.0;

/**
 * Calculate satellite passes for given nights
 */
export function calculateSatellitePasses(
  tle: TLEData,
  location: Location,
  nights: NightInfo[]
): SatellitePass[] {
  const passes: SatellitePass[] = [];

  // Initialize satellite record from TLE
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2);

  // Observer location
  const observerGd = {
    longitude: satellite.degreesToRadians(location.longitude),
    latitude: satellite.degreesToRadians(location.latitude),
    height: 0, // meters above sea level (assume sea level)
  };

  const baseMag = SATELLITE_MAGNITUDES[tle.noradId] ?? DEFAULT_BASE_MAGNITUDE;

  for (const night of nights) {
    // Search from astronomical dusk to dawn
    const startTime = night.astronomicalDusk;
    const endTime = night.astronomicalDawn;

    const nightPasses = findPasses(satrec, observerGd, startTime, endTime, tle, baseMag);
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
  nights: NightInfo[]
): SatellitePass[] {
  const allPasses: SatellitePass[] = [];

  for (const tle of tles) {
    try {
      const passes = calculateSatellitePasses(tle, location, nights);
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
  satrec: satellite.SatRec,
  observerGd: satellite.GeodeticLocation,
  startTime: Date,
  endTime: Date,
  tle: TLEData,
  baseMagnitude: number
): SatellitePass[] {
  const passes: SatellitePass[] = [];
  let currentPass: Partial<SatellitePass> | null = null;
  let maxAlt = 0;

  const startMs = startTime.getTime();
  const endMs = endTime.getTime();

  for (let timeMs = startMs; timeMs <= endMs; timeMs += TIME_STEP_SECONDS * 1000) {
    const time = new Date(timeMs);
    const lookAngles = getLookAngles(satrec, observerGd, time);

    if (!lookAngles) continue;

    const altitudeDeg = satellite.radiansToDegrees(lookAngles.elevation);
    const azimuthDeg = satellite.radiansToDegrees(lookAngles.azimuth);

    if (altitudeDeg >= MIN_ALTITUDE_DEG) {
      // Satellite is above horizon threshold
      if (currentPass) {
        // Update max altitude if this is higher
        if (altitudeDeg > maxAlt) {
          maxAlt = altitudeDeg;
          currentPass.maxAltitude = altitudeDeg;
          currentPass.maxTime = time;
          currentPass.maxAzimuth = normalizeAzimuth(azimuthDeg);
        }
      } else {
        // Start of a new pass
        currentPass = {
          satelliteName: tle.name,
          noradId: tle.noradId,
          riseTime: time,
          riseAzimuth: normalizeAzimuth(azimuthDeg),
          maxAltitude: altitudeDeg,
          maxTime: time,
          maxAzimuth: normalizeAzimuth(azimuthDeg),
          isVisible: true,
        };
        maxAlt = altitudeDeg;
      }
    } else if (currentPass) {
      // End of pass (satellite dropped below threshold)
      currentPass.setTime = time;
      currentPass.setAzimuth = normalizeAzimuth(azimuthDeg);
      currentPass.duration = Math.round(
        (time.getTime() - (currentPass.riseTime?.getTime() ?? 0)) / 1000
      );

      // Estimate magnitude based on max altitude and satellite's base magnitude
      currentPass.magnitude = estimateMagnitude(maxAlt, baseMagnitude);

      passes.push(currentPass as SatellitePass);
      currentPass = null;
      maxAlt = 0;
    }
  }

  // Handle pass that extends beyond search window
  if (currentPass) {
    currentPass.setTime = endTime;
    currentPass.setAzimuth = currentPass.maxAzimuth; // Best estimate
    currentPass.duration = Math.round(
      (endTime.getTime() - (currentPass.riseTime?.getTime() ?? 0)) / 1000
    );
    currentPass.magnitude = estimateMagnitude(maxAlt, baseMagnitude);
    passes.push(currentPass as SatellitePass);
  }

  return passes;
}

/**
 * Get look angles (azimuth, elevation, range) for a satellite at a given time
 */
function getLookAngles(
  satrec: satellite.SatRec,
  observerGd: satellite.GeodeticLocation,
  time: Date
): satellite.LookAngles | null {
  const positionAndVelocity = satellite.propagate(satrec, time);

  if (
    !positionAndVelocity ||
    typeof positionAndVelocity.position === 'boolean' ||
    !positionAndVelocity.position
  ) {
    return null;
  }

  const gmst = satellite.gstime(time);
  const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
  const lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);

  return lookAngles;
}

/**
 * Normalize azimuth to 0-360 range
 */
function normalizeAzimuth(azimuthDeg: number): number {
  let az = azimuthDeg % 360;
  if (az < 0) az += 360;
  return Math.round(az * 10) / 10;
}

/**
 * Estimate satellite magnitude based on altitude and base magnitude.
 * Higher altitude = brighter (closer to observer, better illumination angle).
 */
function estimateMagnitude(altitudeDeg: number, baseMagnitude: number): number {
  // At zenith (90deg), magnitude is at base value
  // At horizon (10deg), dimmer by ~2 magnitudes
  const factor = (90 - altitudeDeg) / 80;
  return Math.round((baseMagnitude + factor * 2) * 10) / 10;
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
