import * as Astronomy from 'astronomy-engine';
import type { GalileanMoonEvent, GalileanMoonPosition, NightInfo } from '@/types';

type MoonName = 'Io' | 'Europa' | 'Ganymede' | 'Callisto';

/**
 * Get the current positions of Jupiter's Galilean moons
 *
 * The JupiterMoons function returns StateVectors for each moon in
 * jovicentric coordinates (AU). We convert to Jupiter radii for display.
 *
 * Note: The z component indicates depth - negative z means the moon is
 * between Jupiter and Earth (potential transit), positive z means behind.
 */
export function getGalileanMoonPositions(date: Date): GalileanMoonPosition[] {
  try {
    const moonsData = Astronomy.JupiterMoons(date);
    const positions: GalileanMoonPosition[] = [];

    // Jupiter's equatorial radius in AU for conversion
    const JUPITER_RADIUS = 71492 / 149597870.7; // km to AU

    // Moon data from the JupiterMoons result
    const moonObjects: Array<{ name: MoonName; data: Astronomy.StateVector }> = [
      { name: 'Io', data: moonsData.io },
      { name: 'Europa', data: moonsData.europa },
      { name: 'Ganymede', data: moonsData.ganymede },
      { name: 'Callisto', data: moonsData.callisto },
    ];

    for (const { name, data } of moonObjects) {
      // Convert from AU to Jupiter radii for easier visualization
      // The StateVector x, y, z are in AU
      const x = data.x / JUPITER_RADIUS;
      const y = data.y / JUPITER_RADIUS;
      const z = data.z / JUPITER_RADIUS;

      // Check if moon is transiting (in front of Jupiter and within disk)
      // Transit occurs when z < 0 (moon closer to Earth than Jupiter center)
      // and the projected distance from center is less than Jupiter's radius
      const distFromCenter = Math.sqrt(x * x + y * y);
      const isTransiting = z < 0 && distFromCenter < 1.0;

      // Shadow detection is complex - simplified to approximate
      // Shadow is visible when moon is in front of Jupiter and not in transit itself
      // A more accurate calculation would involve Sun-Jupiter-Moon geometry
      const shadowOnJupiter =
        z < 0 && distFromCenter < 1.5 && distFromCenter > 0.5 && !isTransiting;

      positions.push({
        name,
        x,
        y,
        z,
        isTransiting,
        shadowOnJupiter,
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

/**
 * Detect transit and shadow events during the night
 * Samples every 5 minutes to find state changes
 */
export function detectGalileanMoonEvents(nightInfo: NightInfo): GalileanMoonEvent[] {
  const events: GalileanMoonEvent[] = [];
  const startTime = nightInfo.astronomicalDusk.getTime();
  const endTime = nightInfo.astronomicalDawn.getTime();
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
      if (transitEvent) events.push(transitEvent);

      const shadowEvent = detectEventTransition(
        pos.name,
        pos.shadowOnJupiter,
        prevShadow.get(pos.name),
        time,
        'shadow_start',
        'shadow_end'
      );
      if (shadowEvent) events.push(shadowEvent);

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
  if (!jupiterVisible) {
    return null;
  }

  try {
    // Get positions at midnight
    const midnight = new Date(
      (nightInfo.astronomicalDusk.getTime() + nightInfo.astronomicalDawn.getTime()) / 2
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

/**
 * Format moon positions for display
 * Returns a description of where each moon is relative to Jupiter
 */
export function formatMoonPositions(positions: GalileanMoonPosition[]): string[] {
  return positions.map(pos => {
    const distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y).toFixed(1);
    const direction = pos.x > 0 ? 'W' : 'E';
    const behind = pos.z > 0 ? ' (behind)' : '';
    const transit = pos.isTransiting ? ' [TRANSIT]' : '';
    const shadow = pos.shadowOnJupiter ? ' [SHADOW]' : '';

    return `${pos.name}: ${distance}Rj ${direction}${behind}${transit}${shadow}`;
  });
}
