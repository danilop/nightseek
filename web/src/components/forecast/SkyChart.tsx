import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Crosshair,
  Loader2,
  Map as MapIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDeviceCompass } from '@/hooks/useDeviceCompass';
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
      className={`rounded-full px-3 py-1.5 font-medium text-xs transition-colors ${
        active
          ? 'border border-white/30 bg-white/10 text-white'
          : 'border border-night-700 bg-night-800 text-gray-500'
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

  // Compass via custom hook
  const { compassAvailable, compassEnabled, compassHeading, toggleCompass } = useDeviceCompass();
  const lastOrientationRef = useRef<number>(0); // Track current orientation for smooth rotation

  const celestialInitialized = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartStatus, setChartStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

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

    const loadScript = (src: string, integrity?: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Remove any existing failed script tag so we can retry
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          // If the global it defines is already available, no need to reload
          if (src.includes('d3-celestial') && typeof Celestial !== 'undefined') {
            resolve();
            return;
          }
          // biome-ignore lint/suspicious/noExplicitAny: d3 loaded via global script
          if (src.includes('d3@') && typeof (window as any).d3 !== 'undefined') {
            resolve();
            return;
          }
          // Script tag exists but global isn't available — remove and retry
          existing.remove();
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = false;
        if (integrity) {
          script.integrity = integrity;
          script.crossOrigin = 'anonymous';
        }
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    const loadCelestialScript = async (): Promise<void> => {
      if (typeof Celestial !== 'undefined') return;

      // biome-ignore lint/suspicious/noExplicitAny: d3 loaded via global script
      if (typeof (window as any).d3 === 'undefined') {
        await loadScript(
          'https://unpkg.com/d3@3.5.17/d3.min.js',
          'sha384-N8EP0Yml0jN7e0DcXlZ6rt+iqKU9Ck6f1ZQ+j2puxatnBq4k9E8Q6vqBcY34LNbn'
        );
      }
      await loadScript(
        'https://unpkg.com/d3-celestial@0.7.35/celestial.min.js',
        'sha384-2dC5WLJBbDzernjwxbynShiaH7BONv9FkNAh7pxDsJiBCe10tB419KJXHzsRZEAr'
      );

      await new Promise<void>((resolve, reject) => {
        let elapsed = 0;
        const checkLoaded = setInterval(() => {
          if (typeof Celestial !== 'undefined') {
            clearInterval(checkLoaded);
            resolve();
          }
          elapsed += 50;
          if (elapsed > 15000) {
            clearInterval(checkLoaded);
            reject(new Error('Timed out waiting for d3-celestial'));
          }
        }, 50);
      });
    };

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: d3-celestial config requires many options
    const initCelestial = async () => {
      setChartStatus('loading');

      try {
        await loadCelestialScript();
      } catch {
        setChartStatus('error');
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

      const dataPath = 'https://unpkg.com/d3-celestial@0.7.35/data/';

      // Measure container width explicitly - wait for layout if needed
      let containerWidth = containerRef.current?.clientWidth ?? 0;
      if (containerWidth === 0) {
        // Container not yet laid out, wait a frame
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
      }
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
        width: containerWidth, // Explicit width (auto-size with 0 can fail)
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
        setChartStatus('ready');
      } catch {
        setChartStatus('error');
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

  // Reset orientation tracking when compass is disabled
  useEffect(() => {
    if (!compassEnabled) {
      lastOrientationRef.current = 0;
    }
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
    <div className="overflow-hidden rounded-xl border border-night-700 bg-night-900">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-night-800"
      >
        <div className="flex items-center gap-3">
          <MapIcon className="h-5 w-5 text-indigo-400" />
          <h3 className="font-semibold text-white">Sky Chart</h3>
          <span className="text-gray-500 text-xs">Interactive sky view</span>
        </div>
        {expanded ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-night-700 border-t p-4">
          {/* Time Slider */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-gray-400 text-xs">
              <span>{formatTime(nightInfo.sunset)}</span>
              <span className="font-medium text-indigo-400">{formatTime(currentTime)}</span>
              <span>{formatTime(nightInfo.sunrise)}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Now button */}
              <button
                type="button"
                onClick={handleNowClick}
                disabled={!isNowInNightRange}
                className={`flex items-center gap-1 rounded px-2 py-1 font-medium text-xs transition-colors ${
                  isNowInNightRange
                    ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                    : 'cursor-not-allowed bg-night-800 text-gray-600'
                }`}
                title={
                  isNowInNightRange
                    ? 'Jump to current time'
                    : `Current time is outside ${getNightLabel(nightInfo.date, true)} range`
                }
              >
                <Clock className="h-3 w-3" />
                Now
              </button>
              {/* Slider */}
              <input
                type="range"
                min="0"
                max="100"
                value={selectedTime}
                onChange={e => setSelectedTime(Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-night-700 accent-indigo-500"
              />
              {/* Center button - disabled when compass is on */}
              <button
                type="button"
                onClick={handleCenterView}
                disabled={compassEnabled}
                className={`rounded p-1.5 font-medium text-xs outline-none transition-colors focus:outline-none active:outline-none ${
                  compassEnabled
                    ? 'cursor-not-allowed bg-night-800/50 text-gray-600'
                    : 'bg-night-800 text-gray-400 hover:bg-night-700 hover:text-white active:bg-night-600'
                }`}
                title={
                  compassEnabled
                    ? 'Disable compass to center manually'
                    : 'Center view (zenith, north up)'
                }
              >
                <Crosshair className="h-4 w-4" />
              </button>
              {/* Compass button - only shown when compass is available */}
              {compassAvailable && (
                <button
                  type="button"
                  onClick={toggleCompass}
                  className={`rounded p-1.5 font-medium text-xs outline-none transition-colors focus:outline-none active:outline-none ${
                    compassEnabled
                      ? 'bg-indigo-500 text-white shadow-indigo-500/30 shadow-lg'
                      : 'border border-night-700 bg-night-800/50 text-gray-500 hover:border-gray-500 active:bg-night-700'
                  }`}
                  title={
                    compassEnabled
                      ? 'Disable compass mode'
                      : 'Enable compass mode (rotate device to look around)'
                  }
                >
                  <Compass className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-1 flex justify-between text-gray-500 text-xs">
              <span>Sunset</span>
              <span>Sunrise</span>
            </div>
          </div>

          {/* Display Options - matching d3-celestial viewer demo */}
          <div className="mb-4 flex flex-wrap gap-2">
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
          <div className="relative">
            <div
              ref={containerRef}
              id="celestial-map"
              className="min-h-[300px] w-full overflow-hidden rounded-lg bg-night-950 sm:min-h-[400px] lg:min-h-[500px] xl:min-h-[600px]"
            />
            {chartStatus === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-night-950">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-xs">Loading sky chart...</span>
                </div>
              </div>
            )}
            {chartStatus === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-night-950">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                  <span className="text-xs">Failed to load sky chart</span>
                  <button
                    type="button"
                    onClick={async () => {
                      // Clear the SW cache for CDN scripts so corrupted entries are refetched
                      try {
                        const cache = await caches.open('cdn-scripts');
                        const keys = await cache.keys();
                        await Promise.all(
                          keys.filter(r => r.url.includes('unpkg.com')).map(r => cache.delete(r))
                        );
                      } catch {
                        // Cache API not available — retry will still attempt reload
                      }
                      celestialInitialized.current = false;
                      setChartStatus('idle');
                      // Clear and re-trigger by collapsing/expanding
                      setExpanded(false);
                      requestAnimationFrame(() => setExpanded(true));
                    }}
                    className="rounded bg-night-700 px-3 py-1 text-white text-xs hover:bg-night-600"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
