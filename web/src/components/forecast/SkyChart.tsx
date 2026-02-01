import * as Astronomy from 'astronomy-engine';
import { ChevronDown, ChevronRight, Compass, Map as MapIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SkyCalculator } from '@/lib/astronomy/calculator';
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
}

interface ChartObject {
  name: string;
  type: 'planet' | 'dso' | 'moon';
  x: number;
  y: number;
  color: string;
  altitude: number;
  azimuth: number;
  magnitude?: number | null;
  subtype?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  object: ChartObject | null;
}

export default function SkyChart({ nightInfo, location, planets, scoredObjects }: SkyChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState<ChartSettings>({
    showMilkyWay: true,
    showGrid: false,
  });
  const [selectedTime, setSelectedTime] = useState<number>(50); // 0-100 slider position
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    object: null,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const objectsRef = useRef<ChartObject[]>([]);

  // Create calculator instance
  const calculator = useMemo(
    () => new SkyCalculator(location.latitude, location.longitude),
    [location.latitude, location.longitude]
  );

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

  // Handle canvas click/tap for tooltips
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ('touches' in event) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }

      const x = clientX - rect.left;
      const y = clientY - rect.top;

      // Find clicked object (within 15px radius)
      const clickedObject = objectsRef.current.find(obj => {
        const dx = obj.x - x;
        const dy = obj.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 15;
      });

      if (clickedObject) {
        setTooltip({
          visible: true,
          x: clickedObject.x,
          y: clickedObject.y,
          object: clickedObject,
        });
      } else {
        setTooltip(prev => ({ ...prev, visible: false }));
      }
    },
    []
  );

  // Draw the sky chart
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: canvas drawing requires sequential operations
  useEffect(() => {
    if (!expanded) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get container dimensions
    const size = Math.min(container.clientWidth, 400);

    // Guard against zero or very small container
    if (size < 100) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 30;

    // Clear objects array
    const objects: ChartObject[] = [];

    // Clear and draw background
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, size, size);

    // Draw horizon circle
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw altitude circles (30°, 60°)
    if (settings.showGrid) {
      ctx.strokeStyle = '#1e3a5f40';
      ctx.lineWidth = 1;
      for (const alt of [30, 60]) {
        const r = radius * (1 - alt / 90);
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw azimuth lines
      for (let az = 0; az < 360; az += 45) {
        const angle = ((az - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.cos(angle), centerY + radius * Math.sin(angle));
        ctx.stroke();
      }
    }

    // Draw Milky Way band (simplified ellipse - position varies by time/season)
    if (settings.showMilkyWay) {
      // Get galactic center position at current time
      const gcRa = 17.761; // Galactic center RA in hours
      const gcDec = -29.0; // Galactic center Dec in degrees
      const gcPos = calculator.getAltAz(gcRa, gcDec, currentTime);

      if (gcPos.altitude > -20) {
        ctx.fillStyle = '#ffffff08';
        ctx.save();
        ctx.translate(centerX, centerY);
        // Rotate based on galactic center azimuth
        ctx.rotate(((gcPos.azimuth - 90) * Math.PI) / 180);
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.25, radius * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw cardinal directions
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', centerX, 15);
    ctx.fillText('S', centerX, size - 15);
    ctx.fillText('E', 15, centerY);
    ctx.fillText('W', size - 15, centerY);

    // Helper to convert alt/az to canvas coordinates
    const altAzToXY = (altitude: number, azimuth: number) => {
      const r = radius * (1 - altitude / 90);
      const angle = ((azimuth - 90) * Math.PI) / 180;
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    };

    // Planet colors
    const planetColors: Record<string, string> = {
      Mercury: '#b8b8b8',
      Venus: '#ffd700',
      Mars: '#ff6347',
      Jupiter: '#daa520',
      Saturn: '#f4d03f',
      Uranus: '#87ceeb',
      Neptune: '#4169e1',
    };

    // Map planet names to Astronomy bodies
    const planetBodies: Record<string, Astronomy.Body> = {
      Mercury: Astronomy.Body.Mercury,
      Venus: Astronomy.Body.Venus,
      Mars: Astronomy.Body.Mars,
      Jupiter: Astronomy.Body.Jupiter,
      Saturn: Astronomy.Body.Saturn,
      Uranus: Astronomy.Body.Uranus,
      Neptune: Astronomy.Body.Neptune,
    };

    // Create observer for planet calculations
    const observer = new Astronomy.Observer(location.latitude, location.longitude, 0);

    // Draw planets at their actual positions for the current time
    for (const planet of planets) {
      if (!planet.isVisible) continue;

      const body = planetBodies[planet.objectName];
      if (!body) continue;

      // Calculate actual position at current time using Astronomy library
      const equator = Astronomy.Equator(body, currentTime, observer, true, true);
      const horizon = Astronomy.Horizon(
        currentTime,
        observer,
        equator.ra * 15,
        equator.dec,
        'normal'
      );

      const altitude = horizon.altitude;
      const azimuth = horizon.azimuth;

      // Only draw if above horizon
      if (altitude < 0) continue;

      const pos = altAzToXY(altitude, azimuth);
      const color = planetColors[planet.objectName] ?? '#ffffff';

      // Draw planet marker
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Add glow for bright planets
      if (planet.magnitude !== null && planet.magnitude < 0) {
        const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 12);
        gradient.addColorStop(0, `${color}60`);
        gradient.addColorStop(1, `${color}00`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      objects.push({
        name: planet.objectName,
        type: 'planet',
        x: pos.x,
        y: pos.y,
        color,
        altitude,
        azimuth,
        magnitude: planet.magnitude,
      });
    }

    // Draw Moon at actual position
    if (nightInfo.moonIllumination > 0) {
      const moonPos = calculator.getMoonPosition(currentTime);

      if (moonPos.altitude > 0) {
        const pos = altAzToXY(moonPos.altitude, moonPos.azimuth);

        // Draw moon with phase visualization
        ctx.fillStyle = '#f5f5dc';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
        ctx.fill();

        // Phase indicator (simplified)
        const phase = nightInfo.moonPhase;
        if (phase < 0.25 || phase > 0.75) {
          // Crescent - draw dark side
          ctx.fillStyle = '#0a0a14';
          ctx.beginPath();
          const offset = phase < 0.25 ? 3 : -3;
          ctx.arc(pos.x + offset, pos.y, 6, 0, Math.PI * 2);
          ctx.fill();
        } else if (phase > 0.4 && phase < 0.6) {
          // Full moon - add glow
          const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 16);
          gradient.addColorStop(0, '#f5f5dc40');
          gradient.addColorStop(1, '#f5f5dc00');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 16, 0, Math.PI * 2);
          ctx.fill();
        }

        objects.push({
          name: 'Moon',
          type: 'moon',
          x: pos.x,
          y: pos.y,
          color: '#f5f5dc',
          altitude: moonPos.altitude,
          azimuth: moonPos.azimuth,
        });
      }
    }

    // Draw top DSOs at actual positions
    for (const dso of topDSOs) {
      const { visibility } = dso;
      if (!visibility.isVisible) continue;

      const { altitude, azimuth } = calculator.getAltAz(
        visibility.raHours,
        visibility.decDegrees,
        currentTime
      );

      if (altitude < 10) continue;

      const pos = altAzToXY(altitude, azimuth);

      // Draw DSO marker
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Draw ring
      ctx.strokeStyle = '#10b98180';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.stroke();

      objects.push({
        name: visibility.commonName || visibility.objectName,
        type: 'dso',
        x: pos.x,
        y: pos.y,
        color: '#10b981',
        altitude,
        azimuth,
        magnitude: dso.magnitude,
        subtype: dso.subtype ?? undefined,
      });
    }

    // Draw zenith marker
    ctx.fillStyle = '#ffffff40';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Store objects for click detection
    objectsRef.current = objects;
  }, [expanded, settings, nightInfo, planets, topDSOs, currentTime, calculator, location]);

  // Close tooltip when time changes
  useEffect(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, [selectedTime]);

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
              label="Milky Way"
              active={settings.showMilkyWay}
              onClick={() => toggleSetting('showMilkyWay')}
            />
            <ToggleButton
              label="Grid"
              active={settings.showGrid}
              onClick={() => toggleSetting('showGrid')}
            />
          </div>

          {/* Canvas with tooltip */}
          <div ref={containerRef} className="flex justify-center relative">
            <canvas
              ref={canvasRef}
              className="rounded-lg cursor-pointer"
              onClick={handleCanvasClick}
              onTouchStart={handleCanvasClick}
            />

            {/* Tooltip */}
            {tooltip.visible && tooltip.object && (
              <div
                className="absolute bg-night-800 border border-night-600 rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none"
                style={{
                  left: Math.min(tooltip.x, (containerRef.current?.clientWidth ?? 300) - 120),
                  top: tooltip.y > 100 ? tooltip.y - 70 : tooltip.y + 20,
                }}
              >
                <div className="text-sm font-medium text-white">{tooltip.object.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Alt: {tooltip.object.altitude.toFixed(0)}° · Az:{' '}
                  {tooltip.object.azimuth.toFixed(0)}°
                </div>
                {tooltip.object.magnitude !== undefined && tooltip.object.magnitude !== null && (
                  <div className="text-xs text-gray-500">
                    Mag: {tooltip.object.magnitude.toFixed(1)}
                  </div>
                )}
                {tooltip.object.subtype && (
                  <div className="text-xs text-gray-500">{tooltip.object.subtype}</div>
                )}
              </div>
            )}
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
              <span className="w-3 h-3 rounded-full bg-yellow-100" />
              <span>Moon</span>
            </div>
          </div>

          {/* Hint */}
          <p className="text-center text-xs text-gray-600 mt-2">Tap objects for details</p>

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
