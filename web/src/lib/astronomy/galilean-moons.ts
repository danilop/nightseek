import * as Astronomy from 'astronomy-engine';
import type { GalileanMoonEvent, GalileanMoonPosition, NightInfo } from '@/types';
import { AU_TO_KM } from './constants';

type MoonName = 'Io' | 'Europa' | 'Ganymede' | 'Callisto';

const MOON_RADIUS_KM: Record<MoonName, number> = {
  Io: Astronomy.IO_RADIUS_KM,
  Europa: Astronomy.EUROPA_RADIUS_KM,
  Ganymede: Astronomy.GANYMEDE_RADIUS_KM,
  Callisto: Astronomy.CALLISTO_RADIUS_KM,
};

/**
 * Get the current positions of Jupiter's Galilean moons
 *
 * The JupiterMoons function returns StateVectors for each moon in
 * jovicentric coordinates (AU). We convert to Jupiter radii for display.
 *
 * Positions are projected into Jupiter's apparent sky plane. The z component
 * is depth along the Earth-to-Jupiter line; negative means closer to Earth.
 */
export function getGalileanMoonPositions(date: Date): GalileanMoonPosition[] {
  try {
    const positions: GalileanMoonPosition[] = [];

    // Backdate Jupiter and its satellites to when the observed light left the
    // system. At Jupiter this correction is commonly 30–50 minutes, large
    // enough to materially shift Io and event times.
    const jupiterGeo = Astronomy.BackdatePosition(
      date,
      Astronomy.Body.Earth,
      Astronomy.Body.Jupiter,
      true
    );
    const moonsData = Astronomy.JupiterMoons(jupiterGeo.t);

    // Jupiter's equatorial radius in AU for conversion.
    const JUPITER_RADIUS = Astronomy.JUPITER_EQUATORIAL_RADIUS_KM / AU_TO_KM;
    const jupiterDistance = jupiterGeo.Length();
    const lineOfSight = {
      x: jupiterGeo.x / jupiterDistance,
      y: jupiterGeo.y / jupiterDistance,
      z: jupiterGeo.z / jupiterDistance,
    };
    const jupiterEquator = Astronomy.EquatorFromVector(jupiterGeo);
    const ra = (jupiterEquator.ra * 15 * Math.PI) / 180;
    const dec = (jupiterEquator.dec * Math.PI) / 180;
    const east = { x: -Math.sin(ra), y: Math.cos(ra), z: 0 };
    const north = {
      x: -Math.sin(dec) * Math.cos(ra),
      y: -Math.sin(dec) * Math.sin(ra),
      z: Math.cos(dec),
    };
    const jupiterHelio = Astronomy.HelioVector(Astronomy.Body.Jupiter, jupiterGeo.t);
    const jupiterSunDistance = jupiterHelio.Length();
    const sunlightDirection = {
      x: jupiterHelio.x / jupiterSunDistance,
      y: jupiterHelio.y / jupiterSunDistance,
      z: jupiterHelio.z / jupiterSunDistance,
    };

    const dot = (
      vector: { x: number; y: number; z: number },
      basis: { x: number; y: number; z: number }
    ) => vector.x * basis.x + vector.y * basis.y + vector.z * basis.z;

    // Moon data from the JupiterMoons result
    const moonObjects: Array<{ name: MoonName; data: Astronomy.StateVector }> = [
      { name: 'Io', data: moonsData.io },
      { name: 'Europa', data: moonsData.europa },
      { name: 'Ganymede', data: moonsData.ganymede },
      { name: 'Callisto', data: moonsData.callisto },
    ];

    for (const { name, data } of moonObjects) {
      const moonVector = { x: data.x, y: data.y, z: data.z };
      // Store +x toward celestial west, matching the direct-view UI.
      const x = -dot(moonVector, east) / JUPITER_RADIUS;
      const y = dot(moonVector, north) / JUPITER_RADIUS;
      const z = dot(moonVector, lineOfSight) / JUPITER_RADIUS;

      // Check if moon is transiting (in front of Jupiter and within disk)
      // Transit occurs when z < 0 (moon closer to Earth than Jupiter center)
      // and the projected distance from center is less than Jupiter's radius
      const distFromCenter = Math.sqrt(x * x + y * y);
      const moonRadiusRatio = MOON_RADIUS_KM[name] / Astronomy.JUPITER_EQUATORIAL_RADIUS_KM;
      const isTransiting = z < 0 && distFromCenter < 1 + moonRadiusRatio;

      // Intersect the anti-solar ray from the moon with Jupiter's sphere.
      const b = 2 * dot(moonVector, sunlightDirection);
      const c = dot(moonVector, moonVector) - JUPITER_RADIUS ** 2;
      const discriminant = b * b - 4 * c;
      let shadowOnJupiter = false;
      let shadowX: number | null = null;
      let shadowY: number | null = null;
      if (discriminant >= 0) {
        const root = Math.sqrt(discriminant);
        const intersections = [(-b - root) / 2, (-b + root) / 2].filter(value => value >= 0);
        if (intersections.length > 0) {
          const distance = Math.min(...intersections);
          const surfacePoint = {
            x: moonVector.x + distance * sunlightDirection.x,
            y: moonVector.y + distance * sunlightDirection.y,
            z: moonVector.z + distance * sunlightDirection.z,
          };
          shadowOnJupiter = dot(surfacePoint, lineOfSight) < 0;
          if (shadowOnJupiter) {
            shadowX = -dot(surfacePoint, east) / JUPITER_RADIUS;
            shadowY = dot(surfacePoint, north) / JUPITER_RADIUS;
          }
        }
      }

      // Check if moon is actually occluded (hidden behind Jupiter's disk)
      // Occultation occurs when z > 0 (moon farther from Earth than Jupiter)
      // AND the projected distance is within Jupiter's disk
      const isOccluded = z > 0 && distFromCenter < 1 + moonRadiusRatio;

      positions.push({
        name,
        x,
        y,
        z,
        isTransiting,
        shadowOnJupiter,
        shadowX,
        shadowY,
        isOccluded,
      });
    }

    return positions;
  } catch (_error) {
    return [];
  }
}

/**
 * Detect a state transition and return an event if one occurred
 */
function detectEventTransition(
  moon: MoonName,
  currentState: boolean,
  previousState: boolean | undefined,
  time: Date,
  startType: GalileanMoonEvent['type'],
  endType: GalileanMoonEvent['type']
): GalileanMoonEvent | null {
  if (currentState && previousState === false) {
    return { moon, type: startType, time };
  }
  if (!currentState && previousState === true) {
    return { moon, type: endType, time };
  }
  return null;
}

function refineTransitionTime(
  moon: MoonName,
  state: 'isTransiting' | 'shadowOnJupiter',
  previousTime: Date,
  currentTime: Date,
  currentState: boolean
): Date {
  let low = previousTime.getTime();
  let high = currentTime.getTime();

  while (high - low > 1000) {
    const middle = (low + high) / 2;
    const position = getGalileanMoonPositions(new Date(middle)).find(item => item.name === moon);
    if (position?.[state] === currentState) high = middle;
    else low = middle;
  }

  return new Date((low + high) / 2);
}

/**
 * Detect transit and shadow events during the night
 * Samples every 5 minutes to find state changes
 */
function detectGalileanMoonEvents(nightInfo: NightInfo): GalileanMoonEvent[] {
  const events: GalileanMoonEvent[] = [];
  const startTime = nightInfo.observingWindowStart.getTime();
  const endTime = nightInfo.observingWindowEnd.getTime();
  const interval = 5 * 60 * 1000; // 5 minutes

  const prevTransiting: Map<MoonName, boolean> = new Map();
  const prevShadow: Map<MoonName, boolean> = new Map();

  for (let t = startTime; t <= endTime; t += interval) {
    const time = new Date(t);
    const positions = getGalileanMoonPositions(time);

    for (const pos of positions) {
      const transitEvent = detectEventTransition(
        pos.name,
        pos.isTransiting,
        prevTransiting.get(pos.name),
        time,
        'transit_start',
        'transit_end'
      );
      if (transitEvent) {
        transitEvent.time = refineTransitionTime(
          pos.name,
          'isTransiting',
          new Date(t - interval),
          time,
          pos.isTransiting
        );
        events.push(transitEvent);
      }

      const shadowEvent = detectEventTransition(
        pos.name,
        pos.shadowOnJupiter,
        prevShadow.get(pos.name),
        time,
        'shadow_start',
        'shadow_end'
      );
      if (shadowEvent) {
        shadowEvent.time = refineTransitionTime(
          pos.name,
          'shadowOnJupiter',
          new Date(t - interval),
          time,
          pos.shadowOnJupiter
        );
        events.push(shadowEvent);
      }

      prevTransiting.set(pos.name, pos.isTransiting);
      prevShadow.set(pos.name, pos.shadowOnJupiter);
    }
  }

  return events.sort((a, b) => a.time.getTime() - b.time.getTime());
}

/**
 * Get Galilean moons data if Jupiter is visible
 */
export function getJupiterMoonsData(
  nightInfo: NightInfo,
  jupiterVisible: boolean
): { positions: GalileanMoonPosition[]; events: GalileanMoonEvent[] } | null {
  if (!jupiterVisible || nightInfo.observingWindowMode === 'none') {
    return null;
  }

  try {
    // Get positions at midnight
    const midnight = new Date(
      (nightInfo.observingWindowStart.getTime() + nightInfo.observingWindowEnd.getTime()) / 2
    );

    const positions = getGalileanMoonPositions(midnight);
    const events = detectGalileanMoonEvents(nightInfo);

    return { positions, events };
  } catch (_error) {
    return null;
  }
}

/**
 * Get human-readable description of moon event
 */
export function describeGalileanMoonEvent(event: GalileanMoonEvent): string {
  switch (event.type) {
    case 'transit_start':
      return `${event.moon} begins transit across Jupiter`;
    case 'transit_end':
      return `${event.moon} transit ends`;
    case 'shadow_start':
      return `${event.moon}'s shadow appears on Jupiter`;
    case 'shadow_end':
      return `${event.moon}'s shadow leaves Jupiter`;
    default:
      return `${event.moon} event`;
  }
}
