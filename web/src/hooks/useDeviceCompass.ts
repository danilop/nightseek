import { useCallback, useEffect, useRef, useState } from 'react';

interface DeviceCompassResult {
  compassAvailable: boolean;
  compassEnabled: boolean;
  compassHeading: number | null;
  toggleCompass: () => Promise<void>;
}

/**
 * Custom hook for device compass/orientation detection and tracking.
 * Handles iOS permission requests and Android absolute orientation.
 */
export function useDeviceCompass(): DeviceCompassResult {
  const [compassAvailable, setCompassAvailable] = useState(false);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestHeading = useRef<number | null>(null);

  // Detect compass availability
  useEffect(() => {
    const hasDeviceOrientation =
      typeof window !== 'undefined' &&
      ('DeviceOrientationEvent' in window || 'ondeviceorientationabsolute' in window);

    if (!hasDeviceOrientation) return;

    // biome-ignore lint/suspicious/noExplicitAny: DeviceOrientationEvent permission API
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      // iOS - compass available but needs permission on toggle
      setCompassAvailable(true);
    } else {
      // Android/other - test if we get orientation events
      const testHandler = (event: DeviceOrientationEvent) => {
        // biome-ignore lint/suspicious/noExplicitAny: webkitCompassHeading is iOS-specific
        const heading = (event as any).webkitCompassHeading ?? event.alpha;
        if (heading !== null && heading !== undefined) {
          setCompassAvailable(true);
        }
        window.removeEventListener('deviceorientation', testHandler);
      };
      window.addEventListener('deviceorientation', testHandler, { once: true });

      const testAbsoluteHandler = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null) {
          setCompassAvailable(true);
        }
        window.removeEventListener('deviceorientationabsolute', testAbsoluteHandler);
      };
      window.addEventListener('deviceorientationabsolute', testAbsoluteHandler, { once: true });
    }
  }, []);

  // Toggle compass on/off
  const toggleCompass = useCallback(async () => {
    if (compassEnabled) {
      setCompassEnabled(false);
      setCompassHeading(null);
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: DeviceOrientationEvent permission API
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission === 'granted') {
          setCompassEnabled(true);
        }
      } catch {
        // Permission denied
      }
    } else {
      setCompassEnabled(true);
    }
  }, [compassEnabled]);

  // Listen to device orientation when enabled, with rAF gating
  useEffect(() => {
    if (!compassEnabled) return;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: cross-platform compass handling requires branching
    const handleOrientation = (event: DeviceOrientationEvent) => {
      // biome-ignore lint/suspicious/noExplicitAny: webkitCompassHeading is iOS-specific
      const e = event as any;
      let heading: number | null = null;

      if (e.webkitCompassHeading !== undefined) {
        heading = e.webkitCompassHeading;
      } else if (event.alpha !== null && event.absolute) {
        heading = (360 - event.alpha) % 360;
      } else if (event.alpha !== null) {
        heading = (360 - event.alpha) % 360;
      }

      if (heading !== null) {
        latestHeading.current = heading;

        // Gate state updates to rAF to avoid 60Hz re-renders
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            if (latestHeading.current !== null) {
              setCompassHeading(latestHeading.current);
            }
          });
        }
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation);
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [compassEnabled]);

  return { compassAvailable, compassEnabled, compassHeading, toggleCompass };
}
