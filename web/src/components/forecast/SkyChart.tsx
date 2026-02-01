import { ChevronDown, ChevronRight, Compass, Map as MapIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Location, NightInfo, ObjectVisibility, ScoredObject } from '@/types';

interface SkyChartProps {
  nightInfo: NightInfo;
  location: Location;
  planets: ObjectVisibility[];
  scoredObjects: ScoredObject[];
}

interface ChartSettings {
  showConstellations: boolean;
  showMilkyWay: boolean;
  showGrid: boolean;
}

export default function SkyChart({ nightInfo, location, planets, scoredObjects }: SkyChartProps) {
  const [expanded, setExpanded] = useState(false);
  const [settings, setSettings] = useState<ChartSettings>({
    showConstellations: true,
    showMilkyWay: true,
    showGrid: false,
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleSetting = (key: keyof ChartSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Get top 5 DSOs for display
  const topDSOs = scoredObjects.filter(obj => obj.category === 'dso').slice(0, 5);

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

    // Guard against zero or very small container (e.g., when hidden)
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

    // Draw Milky Way band (simplified ellipse)
    if (settings.showMilkyWay) {
      ctx.fillStyle = '#ffffff08';
      ctx.beginPath();
      // Simplified representation - actual Milky Way position would need calculation
      ctx.ellipse(centerX, centerY, radius * 0.3, radius * 0.9, Math.PI / 6, 0, Math.PI * 2);
      ctx.fill();
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
      // Azimuth: 0=N, 90=E, 180=S, 270=W
      const r = radius * (1 - altitude / 90);
      const angle = ((azimuth - 90) * Math.PI) / 180; // Adjust so N is up
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    };

    // Draw planets
    for (const planet of planets) {
      if (!planet.isVisible || planet.maxAltitude < 10) continue;

      // Use azimuth at peak for position
      const pos = altAzToXY(planet.maxAltitude, planet.azimuthAtPeak);

      // Planet color based on name
      const planetColors: Record<string, string> = {
        Mercury: '#b8b8b8',
        Venus: '#ffd700',
        Mars: '#ff6347',
        Jupiter: '#daa520',
        Saturn: '#f4d03f',
        Uranus: '#87ceeb',
        Neptune: '#4169e1',
      };

      const color = planetColors[planet.objectName] ?? '#ffffff';

      // Draw planet
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Draw label
      ctx.fillStyle = color;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(planet.objectName, pos.x, pos.y + 14);
    }

    // Draw Moon
    if (nightInfo.moonIllumination > 0) {
      // Simplified moon position (would need actual calculation)
      const moonPhase = nightInfo.moonPhase;
      const moonAlt = 45; // Placeholder
      const moonAz = 180; // Placeholder
      const pos = altAzToXY(moonAlt, moonAz);

      // Draw moon with phase
      ctx.fillStyle = '#f5f5dc';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw phase indicator
      if (moonPhase < 0.5) {
        ctx.fillStyle = '#0a0a14';
        ctx.beginPath();
        ctx.arc(pos.x + 2, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw top DSOs
    for (const dso of topDSOs) {
      const { visibility } = dso;
      if (!visibility.isVisible || visibility.maxAltitude < 20) continue;

      const pos = altAzToXY(visibility.maxAltitude, visibility.azimuthAtPeak);

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
    }

    // Draw zenith marker
    ctx.fillStyle = '#ffffff40';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#ffffff60';
    ctx.fillText('Zenith', centerX, centerY + 12);
  }, [expanded, settings, nightInfo, planets, topDSOs]);

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
          <span className="text-xs text-gray-500">What's up tonight</span>
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
          {/* Toggle buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <ToggleButton
              label="Constellations"
              active={settings.showConstellations}
              onClick={() => toggleSetting('showConstellations')}
            />
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

          {/* Canvas */}
          <div ref={containerRef} className="flex justify-center">
            <canvas ref={canvasRef} className="rounded-lg" />
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
