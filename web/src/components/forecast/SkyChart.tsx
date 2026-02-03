import * as Astronomy from 'astronomy-engine';
import { ChevronDown, ChevronRight, Map as MapIcon, Navigation } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Location, NightInfo, ObjectVisibility, ScoredObject } from '@/types';

// d3-celestial must be loaded via script tag because it uses old D3 v3 that expects browser globals
// biome-ignore lint/suspicious/noExplicitAny: d3-celestial loaded via global script
declare const Celestial: any;

interface SkyChartProps {
  nightInfo: NightInfo;
  location: Location;
  planets: ObjectVisibility[];
  scoredObjects: ScoredObject[];
}

// Planet body mappings (static, defined outside component)
const PLANET_BODIES: Record<string, Astronomy.Body> = {
  Mercury: Astronomy.Body.Mercury,
  Venus: Astronomy.Body.Venus,
  Mars: Astronomy.Body.Mars,
  Jupiter: Astronomy.Body.Jupiter,
  Saturn: Astronomy.Body.Saturn,
  Uranus: Astronomy.Body.Uranus,
  Neptune: Astronomy.Body.Neptune,
};

const PLANET_COLORS: Record<string, string> = {
  Mercury: '#b8b8b8',
  Venus: '#ffd700',
  Mars: '#ff6347',
  Jupiter: '#daa520',
  Saturn: '#f4d03f',
  Uranus: '#87ceeb',
  Neptune: '#4169e1',
};

// d3-celestial canvas size - we render at this fixed size for good quality, then scale to fit
const CELESTIAL_CANVAS_SIZE = 500;

// Fixed display settings - d3-celestial doesn't support dynamic config changes
const CHART_SETTINGS = {
  showMilkyWay: true,
  showGrid: false,
  showEcliptic: true, // Now works correctly with equatorial coordinates
  showConstellations: true,
};

export default function SkyChart({ nightInfo, location, planets, scoredObjects }: SkyChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [useCompass, setUseCompass] = useState(false);
  const [selectedTime, setSelectedTime] = useState<number>(50);
  const [compassHeading, setCompassHeading] = useState<number>(0);
  const [compassAvailable, setCompassAvailable] = useState<boolean | null>(null);
  const [chartSize, setChartSize] = useState<number>(280); // Default size, will be computed

  // Refs for d3-celestial integration
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const celestialInitialized = useRef(false);

  // Refs to hold current data for the redraw callback (avoids stale closures)
  const currentTimeRef = useRef<Date>(new Date());
  const planetsRef = useRef<ObjectVisibility[]>([]);
  const topDSOsRef = useRef<ScoredObject[]>([]);
  const locationRef = useRef<Location>(location);
  const compassHeadingRef = useRef<number>(0);
  const useCompassRef = useRef<boolean>(false);
  const prevCompassHeading = useRef<number>(0);
  const displayHeading = useRef<number>(0); // Smoothed heading for display (avoids 360° jumps)

  // Calculate the actual time from slider position
  const currentTime = useMemo(() => {
    const startTime = nightInfo.sunset.getTime();
    const endTime = nightInfo.sunrise.getTime();
    const timeRange = endTime - startTime;
    return new Date(startTime + (selectedTime / 100) * timeRange);
  }, [nightInfo.sunset, nightInfo.sunrise, selectedTime]);

  // Get top DSOs for display
  const topDSOs = useMemo(
    () => scoredObjects.filter(obj => obj.category === 'dso').slice(0, 8),
    [scoredObjects]
  );

  // Keep refs in sync with current values
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    planetsRef.current = planets;
  }, [planets]);

  useEffect(() => {
    topDSOsRef.current = topDSOs;
  }, [topDSOs]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    compassHeadingRef.current = compassHeading;
    useCompassRef.current = useCompass;
  }, [compassHeading, useCompass]);

  // Compute chart size based on container width (80% of available width)
  useEffect(() => {
    if (!expanded) return;

    const updateChartSize = () => {
      const container = chartContainerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      // Use 80% of container width, with min 200px and max 500px
      const newSize = Math.min(500, Math.max(200, Math.floor(containerWidth * 0.8)));
      setChartSize(newSize);
    };

    // Initial size calculation
    updateChartSize();

    // Set up ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver(updateChartSize);
    if (chartContainerRef.current) {
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [expanded]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check compass availability on mount
  useEffect(() => {
    if (!('DeviceOrientationEvent' in window)) {
      setCompassAvailable(false);
      return;
    }

    const hasRequestPermission =
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function';

    if (hasRequestPermission) {
      setCompassAvailable(true);
    } else {
      let receivedEvent = false;
      const testHandler = (event: DeviceOrientationEvent) => {
        if (event.alpha !== null) {
          receivedEvent = true;
          setCompassAvailable(true);
        }
        window.removeEventListener('deviceorientation', testHandler);
      };

      window.addEventListener('deviceorientation', testHandler, true);

      setTimeout(() => {
        if (!receivedEvent) {
          setCompassAvailable(false);
        }
        window.removeEventListener('deviceorientation', testHandler);
      }, 1000);
    }
  }, []);

  // Handle compass orientation
  useEffect(() => {
    if (!useCompass) {
      setCompassHeading(0);
      // Reset tracking refs when compass is disabled
      prevCompassHeading.current = 0;
      displayHeading.current = 0;
      return;
    }

    if (compassAvailable === false) {
      setUseCompass(false);
      return;
    }

    let mounted = true;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!mounted) return;
      const rawHeading =
        (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
          .webkitCompassHeading ??
        event.alpha ??
        0;
      if (rawHeading === null) return;

      // Calculate shortest rotation path to avoid 360° jumps
      const prev = prevCompassHeading.current;
      let delta = rawHeading - prev;

      // Normalize delta to [-180, 180] range for shortest path
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;

      // Update display heading (cumulative, not wrapped to 0-360)
      displayHeading.current += delta;
      prevCompassHeading.current = rawHeading;

      setCompassHeading(displayHeading.current);
    };

    const startCompass = async () => {
      try {
        if (
          typeof DeviceOrientationEvent !== 'undefined' &&
          typeof (
            DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
          ).requestPermission === 'function'
        ) {
          const permission = await (
            DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
          ).requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation, true);
          } else {
            setUseCompass(false);
          }
        } else {
          window.addEventListener('deviceorientation', handleOrientation, true);
        }
      } catch {
        setUseCompass(false);
      }
    };

    startCompass();

    return () => {
      mounted = false;
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [useCompass, compassAvailable]);

  // Custom redraw function for planets and DSOs - uses refs to access current data
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: canvas drawing requires sequential operations
  const drawCustomOverlays = useCallback(() => {
    if (typeof Celestial === 'undefined') return;

    const canvas = document.querySelector('#celestial-map canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loc = locationRef.current;
    const time = currentTimeRef.current;
    const currentPlanets = planetsRef.current;
    const currentDSOs = topDSOsRef.current;

    const observer = new Astronomy.Observer(loc.latitude, loc.longitude, 0);

    // Draw planets
    for (const planet of currentPlanets) {
      if (!planet.isVisible) continue;

      const body = PLANET_BODIES[planet.objectName];
      if (!body) continue;

      const equator = Astronomy.Equator(body, time, observer, true, true);
      const color = PLANET_COLORS[planet.objectName] ?? '#ffffff';

      // Check if above horizon first
      const horizon = Astronomy.Horizon(time, observer, equator.ra * 15, equator.dec, 'normal');
      if (horizon.altitude < 0) continue;

      // Convert RA/Dec to canvas position using Celestial's projection
      const pos = Celestial.mapProjection([equator.ra * 15, equator.dec]);
      if (!pos || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) continue;

      // Draw planet
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], 5, 0, Math.PI * 2);
      ctx.fill();

      // Add glow for bright planets
      if (planet.magnitude !== null && planet.magnitude < 0) {
        const gradient = ctx.createRadialGradient(pos[0], pos[1], 0, pos[0], pos[1], 10);
        gradient.addColorStop(0, `${color}60`);
        gradient.addColorStop(1, `${color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos[0], pos[1], 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Label
      ctx.fillStyle = color;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(planet.objectName, pos[0], pos[1] - 10);
    }

    // Draw top DSOs
    for (const dso of currentDSOs) {
      const { visibility } = dso;
      if (!visibility.isVisible) continue;

      const pos = Celestial.mapProjection([visibility.raHours * 15, visibility.decDegrees]);
      if (!pos || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) continue;

      // Draw DSO marker
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], 3, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      ctx.strokeStyle = '#10b98180';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos[0], pos[1], 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, []);

  // Initialize d3-celestial once when expanded
  useEffect(() => {
    if (!expanded) return;
    if (celestialInitialized.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Helper to load a script and wait for it
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        // Check if script already exists
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = false; // Load in order
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    };

    // Load d3 v3 first, then d3-celestial (it uses old D3 v3 that requires browser globals)
    const loadCelestialScript = async (): Promise<void> => {
      // Check if already loaded
      if (typeof Celestial !== 'undefined') {
        return;
      }

      // Load d3 v3 first (d3-celestial depends on it)
      // biome-ignore lint/suspicious/noExplicitAny: d3 loaded via global script
      if (typeof (window as any).d3 === 'undefined') {
        await loadScript('https://unpkg.com/d3@3/d3.min.js');
      }

      // Then load d3-celestial
      await loadScript('https://unpkg.com/d3-celestial/celestial.min.js');

      // Wait for Celestial to be available
      await new Promise<void>(resolve => {
        const checkLoaded = setInterval(() => {
          if (typeof Celestial !== 'undefined') {
            clearInterval(checkLoaded);
            resolve();
          }
        }, 50);
      });
    };

    const initCelestial = async () => {
      try {
        await loadCelestialScript();
      } catch {
        return; // Failed to load script
      }

      // Wait for DOM to be ready and container to exist
      await new Promise<void>(resolve => {
        const checkReady = () => {
          const mapDiv = document.getElementById('celestial-map');
          if (mapDiv) {
            // Use requestAnimationFrame to ensure DOM is painted
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

      const mapDiv = document.getElementById('celestial-map');
      if (!mapDiv) return;

      // d3-celestial data files are hosted on unpkg CDN
      const dataPath = 'https://unpkg.com/d3-celestial/data/';

      const config = {
        container: 'celestial-map',
        datapath: dataPath,
        width: CELESTIAL_CANVAS_SIZE, // Fixed canvas size for good quality
        projection: 'stereographic', // Stereographic projection - good for all-sky circular view
        // Use 'follow: zenith' to automatically center on local zenith based on geopos and date
        follow: 'zenith',
        center: null, // Let d3-celestial calculate from follow setting
        geopos: [location.latitude, location.longitude] as [number, number],
        zoomlevel: null,
        zoomextend: 10, // Allow full sky view
        interactive: false,
        form: false,
        controls: false,
        lang: '',
        culture: '',
        daterange: [],
        orientationfixed: true,
        background: {
          fill: '#0a0a14',
          opacity: 1,
          stroke: '#1e293b',
          width: 1.5,
        },
        horizon: {
          show: true,
          stroke: '#3b82f6',
          width: 2,
          fill: '#0a0a14',
          opacity: 0.8,
        },
        daylight: {
          show: false,
        },
        planets: {
          show: false, // We draw our own
        },
        stars: {
          show: true,
          limit: 5,
          colors: true,
          style: { fill: '#ffffff', opacity: 0.85 },
          designation: false,
          designationType: 'name',
          designationStyle: {
            fill: '#ddddbb',
            font: "10px 'Lucida Sans Unicode', Georgia, Times, 'Times Roman', serif",
            align: 'left',
            baseline: 'top',
          },
          designationLimit: 2.5,
          propername: false,
          propernameType: 'name',
          propernameStyle: {
            fill: '#ddddbb',
            font: "11px 'Lucida Sans Unicode', Georgia, Times, 'Times Roman', serif",
            align: 'right',
            baseline: 'bottom',
          },
          propernameLimit: 1.5,
          size: 5,
          exponent: -0.28,
          data: 'stars.6.json',
        },
        dsos: {
          show: false, // We draw our own
        },
        constellations: {
          show: CHART_SETTINGS.showConstellations,
          names: true,
          namesType: 'iau',
          nameStyle: {
            fill: '#6366f1',
            align: 'center',
            baseline: 'middle',
            font: [
              '12px Helvetica, Arial, sans-serif',
              '11px Helvetica, Arial, sans-serif',
              '10px Helvetica, Arial, sans-serif',
            ],
          },
          lines: true,
          lineStyle: { stroke: '#6366f140', width: 1 },
          bounds: false,
        },
        mw: {
          show: CHART_SETTINGS.showMilkyWay,
          style: { fill: '#8090a0', opacity: 0.12 },
        },
        lines: {
          graticule: {
            show: CHART_SETTINGS.showGrid,
            stroke: '#4a90c2',
            width: 0.5,
            opacity: 0.4,
            lon: { pos: [''], fill: '#4a90c2', font: '9px Helvetica, Arial, sans-serif' },
            lat: { pos: [''], fill: '#4a90c2', font: '9px Helvetica, Arial, sans-serif' },
          },
          equatorial: { show: false },
          ecliptic: {
            show: CHART_SETTINGS.showEcliptic,
            stroke: '#facc15',
            width: 2.5,
            opacity: 1,
          },
          galactic: { show: false },
          supergalactic: { show: false },
        },
      };

      try {
        Celestial.display(config);

        // Set initial date and location
        Celestial.date(currentTime);
        Celestial.location([location.latitude, location.longitude]);

        // Register custom overlay callback - this redraw function is called on every redraw
        Celestial.add({
          type: 'raw',
          callback: () => {
            // Initial callback - nothing to do here for raw type
          },
          redraw: drawCustomOverlays,
        });

        celestialInitialized.current = true;

        // Initial redraw to show overlays
        Celestial.redraw();
      } catch {
        // Initialization failed - container may not be ready
      }
    };

    initCelestial();
  }, [expanded, location.latitude, location.longitude, currentTime, drawCustomOverlays]);

  // Update d3-celestial when time changes - update date and let follow:zenith recalculate
  useEffect(() => {
    if (!celestialInitialized.current || typeof Celestial === 'undefined') return;

    try {
      // Update the date - with follow:'zenith', d3-celestial will auto-recalculate zenith position
      Celestial.date(currentTime);

      // If using compass, apply rotation for the orientation
      if (useCompass) {
        // Get current center and apply compass rotation
        const currentCenter = Celestial.skyview()?.center;
        if (currentCenter) {
          Celestial.rotate({ center: [currentCenter[0], currentCenter[1], -compassHeading] });
        }
      }

      Celestial.redraw();
    } catch {
      // Celestial not ready
    }
  }, [currentTime, useCompass, compassHeading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (celestialInitialized.current && typeof Celestial !== 'undefined') {
        // Clear custom callbacks
        Celestial.clear();

        // Clear the container
        const mapDiv = document.getElementById('celestial-map');
        if (mapDiv) {
          mapDiv.innerHTML = '';
        }

        celestialInitialized.current = false;
      }
    };
  }, []);

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
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
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
            <input
              type="range"
              min="0"
              max="100"
              value={selectedTime}
              onChange={e => setSelectedTime(Number(e.target.value))}
              className="w-full h-2 bg-night-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Sunset</span>
              <span>Sunrise</span>
            </div>
          </div>

          {/* Compass toggle (only on devices that support it) */}
          {compassAvailable === true && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setUseCompass(!useCompass)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  useCompass
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-night-800 text-gray-500 border border-night-700'
                }`}
                title={`Heading: ${Math.round(compassHeading)}°`}
              >
                <Navigation className={`w-3 h-3 ${useCompass ? 'animate-pulse' : ''}`} />
                Compass
                {useCompass && (
                  <span className="text-[10px] opacity-75">{Math.round(compassHeading)}°</span>
                )}
              </button>
            </div>
          )}

          {/* Celestial map container - responsive sizing based on container width */}
          <div ref={chartContainerRef} className="w-full flex flex-col items-center">
            {/* Wrapper with cardinal directions - rotates with compass */}
            <div
              className="relative"
              style={{
                width: `${chartSize + 40}px`,
                height: `${chartSize + 40}px`,
                transform: useCompass ? `rotate(${-compassHeading}deg)` : 'rotate(0deg)',
                transition: useCompass ? 'transform 0.15s ease-out' : 'none',
              }}
            >
              {/* Cardinal direction markers - N highlighted in red, rotate with map */}
              <div
                className="absolute text-xs font-bold text-red-500 z-10"
                style={{
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                N
              </div>
              <div
                className="absolute text-xs font-medium text-gray-500 z-10"
                style={{
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                S
              </div>
              <div
                className="absolute text-xs font-medium text-gray-500 z-10"
                style={{
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                E
              </div>
              <div
                className="absolute text-xs font-medium text-gray-500 z-10"
                style={{
                  right: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                W
              </div>
              {/* Circular chart container - clips to circle using clip-path for Safari compatibility */}
              <div
                style={{
                  position: 'absolute',
                  top: '20px',
                  left: '20px',
                  width: `${chartSize}px`,
                  height: `${chartSize}px`,
                  clipPath: 'circle(50%)',
                  WebkitClipPath: 'circle(50%)',
                }}
              >
                {/* Inner wrapper to center the scaled canvas */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div
                    ref={containerRef}
                    id="celestial-map"
                    style={{
                      transform: `scale(${chartSize / CELESTIAL_CANVAS_SIZE})`,
                      transformOrigin: 'center center',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span>Planets</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500" />
              <span>Top DSOs</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 border-t-2 border-yellow-400" />
              <span>Ecliptic</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-4 h-2 bg-gray-500/30 rounded" />
              <span>Milky Way</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
