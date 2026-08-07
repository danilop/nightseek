import { useEffect, useRef, useState } from 'react';
import { HORIZON_SECTOR_CONFIGS } from '@/lib/utils/horizon-profile';

export type CompassAssistState =
  | 'unsupported'
  | 'idle'
  | 'requesting'
  | 'tracking'
  | 'denied'
  | 'error';

interface BrowserDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassAccuracy?: number;
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const SECTOR_WIDTH_DEGREES = 45;
/** Keeps the highlighted sector from flickering at a boundary. */
const SECTOR_HYSTERESIS_DEGREES = 3;

function normalizeHeading(heading: number): number {
  const normalized = heading % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function angularDistance(first: number, second: number): number {
  return Math.abs(((first - second + 540) % 360) - 180);
}

function getSectorIndexFromHeading(heading: number, currentSectorIndex: number | null): number {
  const normalizedHeading = normalizeHeading(heading);

  if (currentSectorIndex !== null) {
    const currentCenter = HORIZON_SECTOR_CONFIGS[currentSectorIndex].centerAzimuth;
    if (
      angularDistance(normalizedHeading, currentCenter) <=
      SECTOR_WIDTH_DEGREES / 2 + SECTOR_HYSTERESIS_DEGREES
    ) {
      return currentSectorIndex;
    }
  }

  return Math.round(normalizedHeading / SECTOR_WIDTH_DEGREES) % HORIZON_SECTOR_CONFIGS.length;
}

function getScreenOrientationAngle(): number {
  const screenAngle = window.screen.orientation?.angle;
  if (typeof screenAngle === 'number') return screenAngle;

  const legacyAngle = (window as Window & { orientation?: number }).orientation;
  return typeof legacyAngle === 'number' ? legacyAngle : 0;
}

function getHeadingFromOrientationEvent(event: BrowserDeviceOrientationEvent): {
  accuracy: number | null;
  heading: number | null;
} {
  const screenAngle = getScreenOrientationAngle();

  if (
    typeof event.webkitCompassHeading === 'number' &&
    Number.isFinite(event.webkitCompassHeading)
  ) {
    return {
      heading: normalizeHeading(event.webkitCompassHeading + screenAngle),
      accuracy:
        typeof event.webkitCompassAccuracy === 'number' &&
        Number.isFinite(event.webkitCompassAccuracy)
          ? event.webkitCompassAccuracy
          : null,
    };
  }

  if (event.absolute && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
    return {
      heading: normalizeHeading(360 - event.alpha + screenAngle),
      accuracy: null,
    };
  }

  return { heading: null, accuracy: null };
}

function removeOrientationListeners(listener: ((event: Event) => void) | null): void {
  if (listener === null) return;
  window.removeEventListener('deviceorientation', listener);
  window.removeEventListener('deviceorientationabsolute', listener);
}

export interface CompassAssist {
  accuracy: number | null;
  state: CompassAssistState;
  stop: (nextState?: CompassAssistState) => void;
  toggle: () => Promise<void>;
  trackedSectorIndex: number | null;
}

/**
 * Maps the device heading onto one of the eight horizon sectors so the user can
 * point the phone at an obstruction instead of naming its direction.
 */
export function useCompassAssist(onDirectionChange: (sectorIndex: number) => void): CompassAssist {
  const orientationListenerRef = useRef<((event: Event) => void) | null>(null);
  const trackedSectorIndexRef = useRef<number | null>(null);
  const [state, setState] = useState<CompassAssistState>('unsupported');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [trackedSectorIndex, setTrackedSectorIndex] = useState<number | null>(null);

  useEffect(() => {
    setState(typeof window.DeviceOrientationEvent === 'undefined' ? 'unsupported' : 'idle');
  }, []);

  const stop = (nextState: CompassAssistState = 'idle') => {
    removeOrientationListeners(orientationListenerRef.current);
    orientationListenerRef.current = null;
    trackedSectorIndexRef.current = null;
    setTrackedSectorIndex(null);
    setAccuracy(null);
    setState(nextState);
  };

  useEffect(
    () => () => {
      removeOrientationListeners(orientationListenerRef.current);
    },
    []
  );

  const toggle = async () => {
    if (state === 'tracking') {
      stop();
      return;
    }

    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setState('unsupported');
      return;
    }

    setState('requesting');
    const orientationEventClass = window.DeviceOrientationEvent as typeof DeviceOrientationEvent &
      DeviceOrientationEventWithPermission;

    try {
      const permission =
        typeof orientationEventClass.requestPermission === 'function'
          ? await orientationEventClass.requestPermission()
          : 'granted';
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      const handleOrientation = (incomingEvent: Event) => {
        const headingResult = getHeadingFromOrientationEvent(
          incomingEvent as BrowserDeviceOrientationEvent
        );
        if (headingResult.heading === null) return;

        const sectorIndex = getSectorIndexFromHeading(
          headingResult.heading,
          trackedSectorIndexRef.current
        );
        trackedSectorIndexRef.current = sectorIndex;
        setTrackedSectorIndex(sectorIndex);
        setAccuracy(headingResult.accuracy);
        onDirectionChange(sectorIndex);
      };

      orientationListenerRef.current = handleOrientation;
      window.addEventListener('deviceorientationabsolute', handleOrientation);
      window.addEventListener('deviceorientation', handleOrientation);
      setState('tracking');
    } catch {
      stop('error');
    }
  };

  return { accuracy, state, stop, toggle, trackedSectorIndex };
}
