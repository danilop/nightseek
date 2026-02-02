import * as Astronomy from 'astronomy-engine';
import Celestial from 'd3-celestial';
import { ChevronDown, ChevronRight, Compass, Map as MapIcon, Navigation } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Location, NightInfo, ObjectVisibility, ScoredObject } from '@/types';

interface SkyChartProps {
  nightInfo: NightInfo;
  location: Location;
  planets: ObjectVisibility[];
  scoredObjects: ScoredObject[];
}

interface ChartSettings {
  showMilkyWay: boolean;
  showGrid: boolean;
  showEcliptic: boolean;
  showConstellations: boolean;
  useCompass: boolean;
}

export default function SkyChart({ nightInfo, location, planets, scoredObjects }: SkyChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState<ChartSettings>({
    showMilkyWay: true,
    showGrid: false,
    showEcliptic: true,
    showConstellations: true,
    useCompass: false,
  });
  const [selectedTime, setSelectedTime] = useState<number>(50); // 0-100 slider position
  const [compassHeading, setCompassHeading] = useState<number>(0);
  const [compassAvailable, setCompassAvailable] = useState<boolean | null>(null);
  const [celestialReady, setCelestialReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const celestialInitialized = useRef(false);

  // Calculate the actual time from slider position
  const currentTime = useMemo(() => {
    const startTime = nightInfo.sunset.getTime();
    const endTime = nightInfo.sunrise.getTime();
    const timeRange = endTime - startTime;
    return new Date(startTime + (selectedTime / 100) * timeRange);
  }, [nightInfo.sunset, nightInfo.sunrise, selectedTime]);

  // Format time for display
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get top DSOs for display
  const topDSOs = useMemo(
    () => scoredObjects.filter(obj => obj.category === 'dso').slice(0, 8),
    [scoredObjects]
  );

  const toggleSetting = (key: keyof ChartSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
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

  // Handle compass/device orientation when enabled
  useEffect(() => {
    if (!settings.useCompass) {
      setCompassHeading(0);
      return;
    }

    if (compassAvailable === false) {
      setSettings(prev => ({ ...prev, useCompass: false }));
      return;
    }

    let mounted = true;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!mounted) return;

      const heading =
        (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
          .webkitCompassHeading ??
        event.alpha ??
        0;

      if (heading !== null) {
        setCompassHeading(heading);
      }
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
            setSettings(prev => ({ ...prev, useCompass: false }));
          }
        } else {
          window.addEventListener('deviceorientation', handleOrientation, true);
        }
      } catch {
        setSettings(prev => ({ ...prev, useCompass: false }));
      }
    };

    startCompass();

    return () => {
      mounted = false;
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [settings.useCompass, compassAvailable]);

  // Initialize d3-celestial
  useEffect(() => {
    if (!expanded || celestialInitialized.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Calculate rotation based on compass heading
    const baseRotation = settings.useCompass ? -compassHeading : 0;

    // Planet data for overlay
    const planetBodies: Record<string, Astronomy.Body> = {
      Mercury: Astronomy.Body.Mercury,
      Venus: Astronomy.Body.Venus,
      Mars: Astronomy.Body.Mars,
      Jupiter: Astronomy.Body.Jupiter,
      Saturn: Astronomy.Body.Saturn,
      Uranus: Astronomy.Body.Uranus,
      Neptune: Astronomy.Body.Neptune,
    };

    const planetColors: Record<string, string> = {
      Mercury: '#b8b8b8',
      Venus: '#ffd700',
      Mars: '#ff6347',
      Jupiter: '#daa520',
      Saturn: '#f4d03f',
      Uranus: '#87ceeb',
      Neptune: '#4169e1',
    };

    const config = {
      container: 'celestial-map',
      width: 0, // auto-size
      projection: 'airy', // Airy projection - good for horizon-centered view
      transform: 'equatorial',
      center: null, // Will be set by horizon
      geopos: [location.latitude, location.longitude] as [number, number],
      follow: 'zenith',
      zoomlevel: null,
      zoomextend: 1,
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
        show: false, // We'll draw our own planets with custom styling
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
        show: false, // We'll draw our own DSOs
      },
      constellations: {
        show: settings.showConstellations,
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
        show: settings.showMilkyWay,
        style: { fill: '#8090a0', opacity: 0.12 },
      },
      lines: {
        graticule: {
          show: settings.showGrid,
          stroke: '#4a90c2',
          width: 0.5,
          opacity: 0.4,
          lon: { pos: [''], fill: '#4a90c2', font: '9px Helvetica, Arial, sans-serif' },
          lat: { pos: [''], fill: '#4a90c2', font: '9px Helvetica, Arial, sans-serif' },
        },
        equatorial: { show: false },
        ecliptic: {
          show: settings.showEcliptic,
          stroke: '#f59e0b',
          width: 1.5,
          opacity: 0.7,
        },
        galactic: { show: false },
        supergalactic: { show: false },
      },
    };

    try {
      Celestial.display(config);

      // Set the date and location
      Celestial.date(currentTime);
      Celestial.location([location.latitude, location.longitude]);

      // Apply compass rotation if enabled
      if (settings.useCompass && compassHeading !== 0) {
        Celestial.rotate({ center: [baseRotation, 0, 0] });
      }

      celestialInitialized.current = true;
      setCelestialReady(true);

      // Add custom callback for drawing planets and DSOs
      Celestial.add({
        type: 'raw',
        // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: d3-celestial callback requires sequential canvas operations
        callback: (error: Error | null) => {
          if (error) return;

          const canvas = document.querySelector('#celestial-map canvas') as HTMLCanvasElement;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

          // Draw planets
          for (const planet of planets) {
            if (!planet.isVisible) continue;

            const body = planetBodies[planet.objectName];
            if (!body) continue;

            const equator = Astronomy.Equator(body, currentTime, observer, true, true);
            const color = planetColors[planet.objectName] ?? '#ffffff';

            // Convert RA/Dec to canvas position using Celestial's projection
            const pos = Celestial.mapProjection([equator.ra * 15, equator.dec]);
            if (!pos || !Number.isFinite(pos[0]) || !Number.isFinite(pos[1])) continue;

            // Check if above horizon
            const horizon = Astronomy.Horizon(
              currentTime,
              observer,
              equator.ra * 15,
              equator.dec,
              'normal'
            );
            if (horizon.altitude < 0) continue;

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
          for (const dso of topDSOs) {
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
        },
        redraw: () => {
          // Called when the map is redrawn
        },
      });

      Celestial.redraw();
    } catch {
      // Failed to initialize d3-celestial - may happen during SSR or if container not ready
    }
  }, [
    expanded,
    location.latitude,
    location.longitude,
    currentTime,
    settings.showMilkyWay,
    settings.showGrid,
    settings.showEcliptic,
    settings.showConstellations,
    settings.useCompass,
    compassHeading,
    planets,
    topDSOs,
  ]);

  // Update d3-celestial when time/settings change
  useEffect(() => {
    if (!celestialReady || !celestialInitialized.current) return;

    try {
      Celestial.date(currentTime);

      // Update visibility settings
      Celestial.apply({
        mw: { show: settings.showMilkyWay },
        lines: {
          graticule: { show: settings.showGrid },
          ecliptic: { show: settings.showEcliptic },
        },
        constellations: { show: settings.showConstellations },
      });

      // Apply compass rotation
      if (settings.useCompass) {
        Celestial.rotate({ center: [-compassHeading, 0, 0] });
      }

      Celestial.redraw();
    } catch {
      // Celestial might not be ready yet
    }
  }, [currentTime, settings, compassHeading, celestialReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      celestialInitialized.current = false;
      setCelestialReady(false);
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

          {/* Toggle buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <ToggleButton
              label="Ecliptic"
              active={settings.showEcliptic}
              onClick={() => toggleSetting('showEcliptic')}
            />
            <ToggleButton
              label="Milky Way"
              active={settings.showMilkyWay}
              onClick={() => toggleSetting('showMilkyWay')}
            />
            <ToggleButton
              label="Constellations"
              active={settings.showConstellations}
              onClick={() => toggleSetting('showConstellations')}
            />
            <ToggleButton
              label="Grid"
              active={settings.showGrid}
              onClick={() => toggleSetting('showGrid')}
            />
            {compassAvailable === true && (
              <button
                type="button"
                onClick={() => toggleSetting('useCompass')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  settings.useCompass
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-night-800 text-gray-500 border border-night-700'
                }`}
                title={`Heading: ${Math.round(compassHeading)}°`}
              >
                <Navigation className={`w-3 h-3 ${settings.useCompass ? 'animate-pulse' : ''}`} />
                Compass
                {settings.useCompass && (
                  <span className="text-[10px] opacity-75">{Math.round(compassHeading)}°</span>
                )}
              </button>
            )}
          </div>

          {/* Celestial map container */}
          <div ref={containerRef} className="flex justify-center">
            <div
              id="celestial-map"
              className="rounded-lg overflow-hidden"
              style={{ maxWidth: '400px', width: '100%' }}
            />
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
            {settings.showEcliptic && (
              <div className="flex items-center gap-1">
                <span className="w-4 border-t-2 border-amber-500/70" />
                <span>Ecliptic</span>
              </div>
            )}
            {settings.showMilkyWay && (
              <div className="flex items-center gap-1">
                <span className="w-4 h-2 bg-gray-500/30 rounded" />
                <span>Milky Way</span>
              </div>
            )}
          </div>

          {/* Location info */}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-500">
            <Compass className="w-3 h-3" />
            <span>
              {location.latitude.toFixed(2)}°{location.latitude >= 0 ? 'N' : 'S'},{' '}
              {location.longitude.toFixed(2)}°{location.longitude >= 0 ? 'E' : 'W'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function ToggleButton({ label, active, onClick }: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
          : 'bg-night-800 text-gray-500 border border-night-700'
      }`}
    >
      {label}
    </button>
  );
}
