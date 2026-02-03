import { ChevronDown, ChevronRight, Map as MapIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Location, NightInfo } from '@/types';

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

export default function SkyChart({ nightInfo, location }: SkyChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTime, setSelectedTime] = useState<number>(50);
  // Display toggles matching d3-celestial viewer demo
  const [showStars, setShowStars] = useState(true);
  const [showDSOs, setShowDSOs] = useState(true);
  const [showConstellations, setShowConstellations] = useState(true);
  const [showLines, setShowLines] = useState(true); // Ecliptic line
  const [showMilkyWay, setShowMilkyWay] = useState(true);
  const [showPlanets, setShowPlanets] = useState(true);
  const celestialInitialized = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate the actual time from slider position
  const currentTime = useMemo(() => {
    const startTime = nightInfo.sunset.getTime();
    const endTime = nightInfo.sunrise.getTime();
    const timeRange = endTime - startTime;
    return new Date(startTime + (selectedTime / 100) * timeRange);
  }, [nightInfo.sunset, nightInfo.sunrise, selectedTime]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Initialize d3-celestial
  useEffect(() => {
    if (!expanded) return;
    if (celestialInitialized.current) return;

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
      // Small (<640px): minimal labels for mobile
      // Medium (640-1024px): moderate labels for tablets/small laptops
      // Large (>1024px): full labels for desktop
      const starLimit = isSmall ? 4.5 : isLarge ? 6 : 5.5;
      const starPropernameLimit = isSmall ? 1.5 : isLarge ? 3 : 2.5;
      const dsoNameLimit = isSmall ? 4 : isLarge ? 8 : 6;
      const starSize = isSmall ? 4 : isLarge ? 6 : 5;
      const starFontSize = isSmall ? '8px' : isLarge ? '11px' : '10px';
      const dsoFontSize = isSmall ? '8px' : isLarge ? '11px' : '10px';
      const constellationFonts = isSmall
        ? [
            "9px 'Helvetica Neue', Arial, sans-serif",
            "8px 'Helvetica Neue', Arial, sans-serif",
            "7px 'Helvetica Neue', Arial, sans-serif",
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
      const planetFontSize = isSmall ? '12px' : isLarge ? '18px' : '17px';
      const planetNameFontSize = isSmall ? '10px' : isLarge ? '15px' : '14px';

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
        stars: {
          show: showStars,
          limit: starLimit,
          colors: true,
          style: { fill: '#ffffff', opacity: 0.85 },
          size: starSize,
          propername: true,
          propernameLimit: starPropernameLimit,
          propernameStyle: {
            fill: '#94a3b8', // slate-400
            font: `${starFontSize} 'Helvetica Neue', Arial, sans-serif`,
            align: 'right',
            baseline: 'bottom',
          },
        },
        dsos: {
          show: showDSOs,
          names: true,
          nameLimit: dsoNameLimit,
          colors: true,
          size: isSmall ? 4 : null,
          nameStyle: {
            font: `${dsoFontSize} 'Helvetica Neue', Arial, sans-serif`,
          },
        },
        constellations: {
          show: showConstellations,
          names: showConstellations,
          lines: showConstellations,
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
          show: showMilkyWay,
          style: { fill: '#64748b', opacity: 0.12 }, // slate-500
        },
        lines: {
          graticule: { show: false },
          equatorial: { show: false },
          ecliptic: { show: showLines },
          galactic: { show: false },
          supergalactic: { show: false },
        },
        planets: {
          show: showPlanets,
          names: !isSmall, // Hide planet names on small screens to reduce clutter
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

        // Remove any form elements d3-celestial creates (we use our own UI)
        const mapDiv = document.getElementById('celestial-map');
        if (mapDiv) {
          // Remove form elements inside the container
          for (const form of mapDiv.querySelectorAll('form')) {
            form.remove();
          }

          // Also check for form siblings (d3-celestial sometimes adds forms as siblings)
          let sibling = mapDiv.nextElementSibling;
          while (sibling) {
            const next = sibling.nextElementSibling;
            if (sibling.tagName === 'FORM' || sibling.querySelector?.('input, select, label')) {
              sibling.remove();
            }
            sibling = next;
          }
        }

        // Set the date/time and location
        Celestial.date(currentTime);
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
  }, [
    expanded,
    location.latitude,
    location.longitude,
    currentTime,
    showStars,
    showDSOs,
    showConstellations,
    showLines,
    showMilkyWay,
    showPlanets,
  ]);

  // Update when time changes
  useEffect(() => {
    if (!celestialInitialized.current || typeof Celestial === 'undefined') return;

    try {
      Celestial.date(currentTime);

      // Rotate to zenith for the new time
      const zenith = Celestial.zenith();
      if (zenith) {
        Celestial.rotate({ center: zenith });
      }

      Celestial.redraw();
    } catch {
      // Celestial not ready
    }
  }, [currentTime]);

  // Update display options
  useEffect(() => {
    if (!celestialInitialized.current || typeof Celestial === 'undefined') return;

    try {
      Celestial.apply({
        stars: { show: showStars },
        dsos: { show: showDSOs },
        constellations: {
          show: showConstellations,
          names: showConstellations,
          lines: showConstellations,
        },
        mw: { show: showMilkyWay },
        lines: {
          graticule: { show: false },
          equatorial: { show: false },
          ecliptic: { show: showLines },
          galactic: { show: false },
          supergalactic: { show: false },
        },
        planets: { show: showPlanets },
      });
    } catch {
      // Celestial not ready
    }
  }, [showStars, showDSOs, showConstellations, showLines, showMilkyWay, showPlanets]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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

          {/* Display Options - matching d3-celestial viewer demo */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setShowStars(!showStars)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showStars
                  ? 'bg-white/10 text-white border border-white/30'
                  : 'bg-night-800 text-gray-500 border border-night-700'
              }`}
            >
              Stars
            </button>
            <button
              type="button"
              onClick={() => setShowDSOs(!showDSOs)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showDSOs
                  ? 'bg-white/10 text-white border border-white/30'
                  : 'bg-night-800 text-gray-500 border border-night-700'
              }`}
            >
              DSOs
            </button>
            <button
              type="button"
              onClick={() => setShowConstellations(!showConstellations)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showConstellations
                  ? 'bg-white/10 text-white border border-white/30'
                  : 'bg-night-800 text-gray-500 border border-night-700'
              }`}
            >
              Constellations
            </button>
            <button
              type="button"
              onClick={() => setShowLines(!showLines)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showLines
                  ? 'bg-white/10 text-white border border-white/30'
                  : 'bg-night-800 text-gray-500 border border-night-700'
              }`}
            >
              Ecliptic
            </button>
            <button
              type="button"
              onClick={() => setShowMilkyWay(!showMilkyWay)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showMilkyWay
                  ? 'bg-white/10 text-white border border-white/30'
                  : 'bg-night-800 text-gray-500 border border-night-700'
              }`}
            >
              Milky Way
            </button>
            <button
              type="button"
              onClick={() => setShowPlanets(!showPlanets)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                showPlanets
                  ? 'bg-white/10 text-white border border-white/30'
                  : 'bg-night-800 text-gray-500 border border-night-700'
              }`}
            >
              Planets
            </button>
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
