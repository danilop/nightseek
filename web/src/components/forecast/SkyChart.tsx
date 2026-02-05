import { ChevronDown, ChevronRight, Clock, Compass, Crosshair, Map as MapIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getNightLabel } from '@/lib/utils/format';
import type { Location, NightInfo } from '@/types';

/**
 * Calculate the slider position (0-100) for a given time within the night range.
 * Returns null if the time is outside the sunset-sunrise range.
 */
function getSliderPositionForTime(time: Date, sunset: Date, sunrise: Date): number | null {
  const startTime = sunset.getTime();
  const endTime = sunrise.getTime();
  const currentMs = time.getTime();

  if (currentMs < startTime || currentMs > endTime) {
    return null; // Outside night range
  }

  const timeRange = endTime - startTime;
  return ((currentMs - startTime) / timeRange) * 100;
}

// d3-celestial must be loaded via script tag because it uses old D3 v3 that expects browser globals
// biome-ignore lint/suspicious/noExplicitAny: d3-celestial loaded via global script
declare const Celestial: any;

interface SkyChartProps {
  nightInfo: NightInfo;
  location: Location;
}

// Responsive config thresholds (Tailwind breakpoints)
const SMALL_SCREEN_WIDTH = 640; // sm breakpoint
const MEDIUM_SCREEN_WIDTH = 1024; // lg breakpoint

/** Reusable toggle button for display options */
function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-white/10 text-white border border-white/30'
          : 'bg-night-800 text-gray-500 border border-night-700'
      }`}
    >
      {label}
    </button>
  );
}

export default function SkyChart({ nightInfo, location }: SkyChartProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate initial slider position: "now" if within night, otherwise midpoint
  const getInitialSliderPosition = useCallback(() => {
    const nowPosition = getSliderPositionForTime(new Date(), nightInfo.sunset, nightInfo.sunrise);
    return nowPosition ?? 50; // Default to midpoint if outside night range
  }, [nightInfo.sunset, nightInfo.sunrise]);

  const [selectedTime, setSelectedTime] = useState<number>(getInitialSliderPosition);

  // Ref for animation frame to allow cancellation
  const animationRef = useRef<number | null>(null);

  // Handler for "Now" button with smooth animation
  const handleNowClick = useCallback(() => {
    const nowPosition = getSliderPositionForTime(new Date(), nightInfo.sunset, nightInfo.sunrise);
    if (nowPosition === null) return;

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startPosition = selectedTime;
    const distance = nowPosition - startPosition;
    const duration = 400; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic for smooth deceleration
      const eased = 1 - (1 - progress) ** 3;
      const newPosition = startPosition + distance * eased;

      setSelectedTime(newPosition);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [nightInfo.sunset, nightInfo.sunrise, selectedTime]);

  // Check if "now" is within the night range (to show/enable the Now button)
  const isNowInNightRange = useMemo(() => {
    return getSliderPositionForTime(new Date(), nightInfo.sunset, nightInfo.sunrise) !== null;
  }, [nightInfo.sunset, nightInfo.sunrise]);

  // Handler for center button: recenter on zenith with north up (orientation 0)
  const handleCenterView = useCallback(() => {
    if (!celestialInitialized.current || typeof Celestial === 'undefined') return;

    try {
      const zenith = Celestial.zenith();
      if (zenith) {
        // Center on zenith with orientation 0 (north up)
        // zenith returns [longitude, latitude], we add 0 for orientation
        Celestial.rotate({ center: [zenith[0], zenith[1], 0] });
        Celestial.redraw(); // Force redraw to apply changes (needed on mobile)
      }
    } catch {
      // Celestial not ready
    }
  }, []);

  // Display toggles matching d3-celestial viewer demo
  // Mobile defaults: reduced clutter (no DSOs, no Milky Way, no Ecliptic, no names)
  const getIsSmallScreen = useCallback(() => {
    return (typeof window !== 'undefined' ? window.innerWidth : 1024) < SMALL_SCREEN_WIDTH;
  }, []);

  const [showStars, setShowStars] = useState(true);
  const [showDSOs, setShowDSOs] = useState(() => !getIsSmallScreen()); // OFF on mobile
  const [showConstellations, setShowConstellations] = useState(true);
  const [showLines, setShowLines] = useState(() => !getIsSmallScreen()); // Ecliptic OFF on mobile
  const [showMilkyWay, setShowMilkyWay] = useState(() => !getIsSmallScreen()); // OFF on mobile
  const [showPlanets, setShowPlanets] = useState(true);
  const [showNames, setShowNames] = useState(() => !getIsSmallScreen()); // Names OFF on mobile

  // Compass state
  const [compassAvailable, setCompassAvailable] = useState(false);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const lastOrientationRef = useRef<number>(0); // Track current orientation for smooth rotation

  const celestialInitialized = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store initial time for first render - don't add currentTime as init dependency
  const initialTimeRef = useRef<Date | null>(null);

  // Calculate the actual time from slider position
  const currentTime = useMemo(() => {
    const startTime = nightInfo.sunset.getTime();
    const endTime = nightInfo.sunrise.getTime();
    const timeRange = endTime - startTime;
    return new Date(startTime + (selectedTime / 100) * timeRange);
  }, [nightInfo.sunset, nightInfo.sunrise, selectedTime]);

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Initialize d3-celestial - only runs once when first expanded
  // Display options use defaults here; the update effect syncs actual state after init
  useEffect(() => {
    if (!expanded) return;
    if (celestialInitialized.current) return;

    // Capture current time at init start
    initialTimeRef.current = currentTime;

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    const loadCelestialScript = async (): Promise<void> => {
      if (typeof Celestial !== 'undefined') return;

      // biome-ignore lint/suspicious/noExplicitAny: d3 loaded via global script
      if (typeof (window as any).d3 === 'undefined') {
        await loadScript('https://unpkg.com/d3@3/d3.min.js');
      }
      await loadScript('https://unpkg.com/d3-celestial/celestial.min.js');

      await new Promise<void>(resolve => {
        const checkLoaded = setInterval(() => {
          if (typeof Celestial !== 'undefined') {
            clearInterval(checkLoaded);
            resolve();
          }
        }, 50);
      });
    };

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: d3-celestial config requires many options
    const initCelestial = async () => {
      try {
        await loadCelestialScript();
      } catch {
        return;
      }

      await new Promise<void>(resolve => {
        const checkReady = () => {
          const mapDiv = document.getElementById('celestial-map');
          if (mapDiv) {
            requestAnimationFrame(() => {
              mapDiv.innerHTML = '';
              resolve();
            });
          } else {
            requestAnimationFrame(checkReady);
          }
        };
        checkReady();
      });

      const dataPath = 'https://unpkg.com/d3-celestial/data/';

      // Check container width for responsive config
      const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
      const isSmall = containerWidth < SMALL_SCREEN_WIDTH;
      const isLarge = containerWidth >= MEDIUM_SCREEN_WIDTH;

      // Responsive settings: adjust visual density based on screen size
      // Small (<640px): minimal labels for mobile (smaller fonts)
      // Medium (640-1024px): moderate labels for tablets/small laptops
      // Large (>1024px): full labels for desktop
      const starLimit = isSmall ? 4.5 : isLarge ? 6 : 5.5;
      const starPropernameLimit = isSmall ? 1.5 : isLarge ? 3 : 2.5;
      const dsoNameLimit = isSmall ? 4 : isLarge ? 8 : 6;
      const starSize = isSmall ? 4 : isLarge ? 6 : 5;
      const starFontSize = isSmall ? '7px' : isLarge ? '11px' : '10px';
      const dsoFontSize = isSmall ? '7px' : isLarge ? '11px' : '10px';
      const constellationFonts = isSmall
        ? [
            "8px 'Helvetica Neue', Arial, sans-serif",
            "7px 'Helvetica Neue', Arial, sans-serif",
            "6px 'Helvetica Neue', Arial, sans-serif",
          ]
        : isLarge
          ? [
              "14px 'Helvetica Neue', Arial, sans-serif",
              "13px 'Helvetica Neue', Arial, sans-serif",
              "12px 'Helvetica Neue', Arial, sans-serif",
            ]
          : [
              "12px 'Helvetica Neue', Arial, sans-serif",
              "11px 'Helvetica Neue', Arial, sans-serif",
              "10px 'Helvetica Neue', Arial, sans-serif",
            ];
      const planetFontSize = isSmall ? '11px' : isLarge ? '18px' : '17px';
      const planetNameFontSize = isSmall ? '9px' : isLarge ? '15px' : '14px';

      // Config with app-matching dark theme styling and responsive settings
      const config = {
        container: 'celestial-map',
        datapath: dataPath,
        width: 0, // Auto-size to parent
        projection: 'stereographic', // Good for local sky views
        transform: 'equatorial',
        follow: 'zenith',
        geopos: [location.latitude, location.longitude],
        zoomlevel: null,
        zoomextend: isSmall ? 5 : isLarge ? 12 : 10, // Zoom range by screen size
        interactive: true,
        disableAnimations: false,
        form: false, // We use our own UI
        location: true, // Enable location-based zenith calculation
        controls: false,
        lang: '',
        // Dark theme to match app
        background: {
          fill: '#0f172a', // night-900
          opacity: 1,
          stroke: '#334155', // slate-700
          width: 1.5,
        },
        horizon: {
          show: true,
          stroke: '#475569', // slate-600
          width: isSmall ? 1 : isLarge ? 2 : 1.5,
          fill: '#0f172a',
          opacity: 0.8,
        },
        // Configure display options based on screen size
        // Mobile: reduced clutter (no names, no DSOs, no Milky Way, no Ecliptic)
        stars: {
          show: true,
          limit: starLimit,
          colors: true,
          style: { fill: '#ffffff', opacity: 0.85 },
          size: starSize,
          propername: !isSmall, // Names OFF on mobile
          propernameLimit: starPropernameLimit,
          propernameStyle: {
            fill: '#94a3b8', // slate-400
            font: `${starFontSize} 'Helvetica Neue', Arial, sans-serif`,
            align: 'right',
            baseline: 'bottom',
          },
        },
        dsos: {
          show: !isSmall, // DSOs OFF on mobile
          names: !isSmall, // Names OFF on mobile
          nameLimit: dsoNameLimit,
          colors: true,
          size: isSmall ? 4 : null,
          nameStyle: {
            font: `${dsoFontSize} 'Helvetica Neue', Arial, sans-serif`,
          },
        },
        constellations: {
          show: true, // Lines always visible
          names: !isSmall, // Names OFF on mobile
          lines: true,
          namesType: 'iau',
          nameStyle: {
            fill: '#818cf8', // indigo-400
            align: 'center',
            baseline: 'middle',
            font: constellationFonts,
          },
          lineStyle: { stroke: '#6366f180', width: isSmall ? 0.5 : isLarge ? 1.5 : 1 },
        },
        mw: {
          show: !isSmall, // Milky Way OFF on mobile
          style: { fill: '#64748b', opacity: 0.12 }, // slate-500
        },
        lines: {
          graticule: { show: false },
          equatorial: { show: false },
          ecliptic: { show: !isSmall }, // Ecliptic OFF on mobile
          galactic: { show: false },
          supergalactic: { show: false },
        },
        planets: {
          show: true,
          names: !isSmall, // Planet names OFF on small screens
          symbolStyle: {
            font: `bold ${planetFontSize} 'Lucida Sans Unicode', sans-serif`,
          },
          nameStyle: {
            font: `${planetNameFontSize} 'Lucida Sans Unicode', sans-serif`,
          },
        },
        daylight: {
          show: false,
        },
      };

      try {
        Celestial.display(config);

        // Set the date/time and location using the captured initial time
        const initTime = initialTimeRef.current ?? new Date();
        Celestial.date(initTime);
        Celestial.location([location.latitude, location.longitude]);

        // KEY: Use Celestial.zenith() to get proper zenith coordinates and rotate to it
        // This is how d3-celestial's form UI achieves zenith centering
        const zenith = Celestial.zenith();
        if (zenith) {
          Celestial.rotate({ center: zenith });
        }

        celestialInitialized.current = true;
      } catch {
        // Celestial initialization failed silently
      }
    };

    initCelestial();
  }, [expanded, location.latitude, location.longitude, currentTime]);

  // Update when time changes
  useEffect(() => {
    if (!celestialInitialized.current || typeof Celestial === 'undefined') return;

    try {
      Celestial.date(currentTime);

      // Rotate to zenith for the new time, preserving compass orientation if enabled
      const zenith = Celestial.zenith();
      if (zenith) {
        // Use tracked orientation when compass is enabled, otherwise 0 (north up)
        const orientation = compassEnabled ? lastOrientationRef.current : 0;
        Celestial.rotate({ center: [zenith[0], zenith[1], orientation] });
      }

      Celestial.redraw();
    } catch {
      // Celestial not ready
    }
  }, [currentTime, compassEnabled]);

  // Update display options
  useEffect(() => {
    if (!celestialInitialized.current || typeof Celestial === 'undefined') return;

    try {
      Celestial.apply({
        stars: {
          show: showStars,
          propername: showStars && showNames, // Names toggle controls star names
        },
        dsos: {
          show: showDSOs,
          names: showDSOs && showNames, // Names toggle controls DSO names
        },
        constellations: {
          show: showConstellations,
          names: showConstellations && showNames, // Names toggle controls constellation names
          lines: showConstellations, // Lines stay visible when constellations enabled
        },
        mw: { show: showMilkyWay },
        lines: {
          graticule: { show: false },
          equatorial: { show: false },
          ecliptic: { show: showLines },
          galactic: { show: false },
          supergalactic: { show: false },
        },
        planets: {
          show: showPlanets,
          names: showPlanets && showNames, // Names toggle controls planet names
        },
      });
    } catch {
      // Celestial not ready
    }
  }, [showStars, showDSOs, showConstellations, showLines, showMilkyWay, showPlanets, showNames]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel any ongoing slider animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (celestialInitialized.current && typeof Celestial !== 'undefined') {
        try {
          Celestial.clear();
          const mapDiv = document.getElementById('celestial-map');
          if (mapDiv) mapDiv.innerHTML = '';
        } catch {
          // Ignore cleanup errors
        }
        celestialInitialized.current = false;
      }
    };
  }, []);

  // Detect compass availability
  useEffect(() => {
    // Check if DeviceOrientationEvent is available and has the 'absolute' property
    // or if we can use webkitCompassHeading (iOS)
    const hasDeviceOrientation =
      typeof window !== 'undefined' &&
      ('DeviceOrientationEvent' in window || 'ondeviceorientationabsolute' in window);

    if (hasDeviceOrientation) {
      // On iOS 13+, we need to check if permission API exists
      // biome-ignore lint/suspicious/noExplicitAny: DeviceOrientationEvent permission API
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === 'function') {
        // iOS - compass available but needs permission request on toggle
        setCompassAvailable(true);
      } else {
        // Android/other - test if we get orientation events
        const testHandler = (event: DeviceOrientationEvent) => {
          // Check if we have a valid heading (alpha or webkitCompassHeading)
          // biome-ignore lint/suspicious/noExplicitAny: webkitCompassHeading is iOS-specific
          const heading = (event as any).webkitCompassHeading ?? event.alpha;
          if (heading !== null && heading !== undefined) {
            setCompassAvailable(true);
          }
          window.removeEventListener('deviceorientation', testHandler);
        };
        window.addEventListener('deviceorientation', testHandler, { once: true });

        // Also try absolute orientation
        const testAbsoluteHandler = (event: DeviceOrientationEvent) => {
          if (event.alpha !== null) {
            setCompassAvailable(true);
          }
          window.removeEventListener('deviceorientationabsolute', testAbsoluteHandler);
        };
        window.addEventListener('deviceorientationabsolute', testAbsoluteHandler, { once: true });
      }
    }
  }, []);

  // Handle compass toggle
  const handleCompassToggle = useCallback(async () => {
    if (compassEnabled) {
      // Turn off compass
      setCompassEnabled(false);
      setCompassHeading(null);
      lastOrientationRef.current = 0; // Reset orientation tracking
      return;
    }

    // Turn on compass - may need permission on iOS
    // biome-ignore lint/suspicious/noExplicitAny: DeviceOrientationEvent permission API
    const DOE = DeviceOrientationEvent as any;
    if (typeof DOE.requestPermission === 'function') {
      try {
        const permission = await DOE.requestPermission();
        if (permission === 'granted') {
          setCompassEnabled(true);
        }
      } catch {
        // Permission denied or error
      }
    } else {
      // No permission needed (Android/desktop)
      setCompassEnabled(true);
    }
  }, [compassEnabled]);

  // Listen to device orientation when compass is enabled
  useEffect(() => {
    if (!compassEnabled) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // webkitCompassHeading is iOS-specific and gives true north
      // alpha gives orientation relative to arbitrary starting point
      // For absolute heading, prefer webkitCompassHeading or deviceorientationabsolute
      // biome-ignore lint/suspicious/noExplicitAny: webkitCompassHeading is iOS-specific
      const e = event as any;
      let heading: number | null = null;

      if (e.webkitCompassHeading !== undefined) {
        // iOS - webkitCompassHeading is degrees from true north (0-360)
        heading = e.webkitCompassHeading;
      } else if (event.alpha !== null && event.absolute) {
        // Android with absolute orientation - alpha is degrees from north
        heading = (360 - event.alpha) % 360;
      } else if (event.alpha !== null) {
        // Fallback - use alpha directly (may not be true north)
        heading = (360 - event.alpha) % 360;
      }

      if (heading !== null) {
        setCompassHeading(heading);
      }
    };

    // Try absolute orientation first (Android)
    window.addEventListener('deviceorientationabsolute', handleOrientation);
    // Also listen to regular orientation (iOS uses this with webkitCompassHeading)
    window.addEventListener('deviceorientation', handleOrientation);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [compassEnabled]);

  // Update sky chart rotation when compass heading changes
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Compass handling requires checking multiple states
  useEffect(() => {
    if (!compassEnabled || compassHeading === null) return;
    if (!celestialInitialized.current || typeof Celestial === 'undefined') return;

    try {
      const zenith = Celestial.zenith();
      if (zenith) {
        // Calculate target orientation (negative of compass heading)
        const targetOrientation = -compassHeading;

        // Calculate shortest path rotation to avoid going the long way around
        // e.g., from 350° to 10° should go +20°, not -340°
        let delta = targetOrientation - lastOrientationRef.current;

        // Normalize delta to [-180, 180] range for shortest path
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;

        // Calculate the actual orientation to use (accumulated to avoid jumps)
        const newOrientation = lastOrientationRef.current + delta;
        lastOrientationRef.current = newOrientation;

        // Rotate view to match device heading
        Celestial.rotate({ center: [zenith[0], zenith[1], newOrientation] });
        Celestial.redraw();
      }
    } catch {
      // Celestial not ready
    }
  }, [compassEnabled, compassHeading]);

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-night-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MapIcon className="w-5 h-5 text-indigo-400" />
          <h3 className="font-semibold text-white">Sky Chart</h3>
          <span className="text-xs text-gray-500">Interactive sky view</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t border-night-700 p-4">
          {/* Time Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>{formatTime(nightInfo.sunset)}</span>
              <span className="text-indigo-400 font-medium">{formatTime(currentTime)}</span>
              <span>{formatTime(nightInfo.sunrise)}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Now button */}
              <button
                type="button"
                onClick={handleNowClick}
                disabled={!isNowInNightRange}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                  isNowInNightRange
                    ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                    : 'bg-night-800 text-gray-600 cursor-not-allowed'
                }`}
                title={
                  isNowInNightRange
                    ? 'Jump to current time'
                    : `Current time is outside ${getNightLabel(nightInfo.date, true)} range`
                }
              >
                <Clock className="w-3 h-3" />
                Now
              </button>
              {/* Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={selectedTime}
                onChange={e => setSelectedTime(Number(e.target.value))}
                className="flex-1 h-2 bg-night-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              {/* Center button - disabled when compass is on */}
              <button
                type="button"
                onClick={handleCenterView}
                disabled={compassEnabled}
                className={`p-1.5 rounded text-xs font-medium transition-colors outline-none focus:outline-none active:outline-none ${
                  compassEnabled
                    ? 'bg-night-800/50 text-gray-600 cursor-not-allowed'
                    : 'bg-night-800 text-gray-400 hover:bg-night-700 hover:text-white active:bg-night-600'
                }`}
                title={
                  compassEnabled
                    ? 'Disable compass to center manually'
                    : 'Center view (zenith, north up)'
                }
              >
                <Crosshair className="w-4 h-4" />
              </button>
              {/* Compass button - only shown when compass is available */}
              {compassAvailable && (
                <button
                  type="button"
                  onClick={handleCompassToggle}
                  className={`p-1.5 rounded text-xs font-medium transition-colors outline-none focus:outline-none active:outline-none ${
                    compassEnabled
                      ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-night-800/50 text-gray-500 border border-night-700 hover:border-gray-500 active:bg-night-700'
                  }`}
                  title={
                    compassEnabled
                      ? 'Disable compass mode'
                      : 'Enable compass mode (rotate device to look around)'
                  }
                >
                  <Compass className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Sunset</span>
              <span>Sunrise</span>
            </div>
          </div>

          {/* Display Options - matching d3-celestial viewer demo */}
          <div className="flex flex-wrap gap-2 mb-4">
            <ToggleButton
              label="Stars"
              active={showStars}
              onClick={() => setShowStars(!showStars)}
            />
            <ToggleButton label="DSOs" active={showDSOs} onClick={() => setShowDSOs(!showDSOs)} />
            <ToggleButton
              label="Constellations"
              active={showConstellations}
              onClick={() => setShowConstellations(!showConstellations)}
            />
            <ToggleButton
              label="Names"
              active={showNames}
              onClick={() => setShowNames(!showNames)}
            />
            <ToggleButton
              label="Ecliptic"
              active={showLines}
              onClick={() => setShowLines(!showLines)}
            />
            <ToggleButton
              label="Milky Way"
              active={showMilkyWay}
              onClick={() => setShowMilkyWay(!showMilkyWay)}
            />
            <ToggleButton
              label="Planets"
              active={showPlanets}
              onClick={() => setShowPlanets(!showPlanets)}
            />
          </div>

          {/* Sky Chart */}
          <div
            ref={containerRef}
            id="celestial-map"
            className="w-full min-h-[300px] sm:min-h-[400px] lg:min-h-[500px] xl:min-h-[600px] bg-night-950 rounded-lg overflow-hidden"
          />
        </div>
      )}
    </div>
  );
}
