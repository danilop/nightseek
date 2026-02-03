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

      // Config with app-matching dark theme styling
      const config = {
        container: 'celestial-map',
        datapath: dataPath,
        width: 0, // Auto-size
        projection: 'stereographic', // Good for local sky views
        transform: 'equatorial',
        follow: 'zenith',
        geopos: [location.latitude, location.longitude],
        zoomlevel: null,
        zoomextend: 10,
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
          width: 1.5,
          fill: '#0f172a',
          opacity: 0.8,
        },
        stars: {
          show: showStars,
          limit: 5.5,
          colors: true,
          style: { fill: '#ffffff', opacity: 0.85 },
          propername: true,
          propernameLimit: 2.5,
          propernameStyle: {
            fill: '#94a3b8', // slate-400
            font: "10px 'Helvetica Neue', Arial, sans-serif",
            align: 'right',
            baseline: 'bottom',
          },
        },
        dsos: {
          show: showDSOs,
          names: true,
          nameLimit: 6,
          colors: true,
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
            font: [
              "12px 'Helvetica Neue', Arial, sans-serif",
              "11px 'Helvetica Neue', Arial, sans-serif",
              "10px 'Helvetica Neue', Arial, sans-serif",
            ],
          },
          lineStyle: { stroke: '#6366f180', width: 1 }, // indigo-500 with opacity
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
          names: true,
        },
        daylight: {
          show: false,
        },
      };

      try {
        Celestial.display(config);

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
      } catch (e) {
        console.error('Failed to initialize Celestial:', e);
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
            id="celestial-map"
            className="w-full min-h-[400px] bg-night-950 rounded-lg overflow-hidden"
          />
        </div>
      )}
    </div>
  );
}
