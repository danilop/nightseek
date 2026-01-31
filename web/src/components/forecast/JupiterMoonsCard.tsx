import { ChevronDown, ChevronUp, Circle } from 'lucide-react';
import { useState } from 'react';
import { describeGalileanMoonEvent } from '@/lib/astronomy/galilean-moons';
import { formatTime } from '@/lib/utils/format';
import type { GalileanMoonEvent, GalileanMoonPosition } from '@/types';

interface JupiterMoonsCardProps {
  positions: GalileanMoonPosition[];
  events: GalileanMoonEvent[];
}

export default function JupiterMoonsCard({ positions, events }: JupiterMoonsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasActiveEvents =
    events.length > 0 || positions.some(p => p.isTransiting || p.shadowOnJupiter);

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 border-b border-night-700 flex items-center justify-between hover:bg-night-800 transition-colors"
      >
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span className="text-xl">&#x2643;</span>
          Jupiter's Galilean Moons
          {hasActiveEvents && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
              Events Tonight
            </span>
          )}
        </h3>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Visual diagram of moon positions */}
          <MoonPositionDiagram positions={positions} />

          {/* Moon details */}
          <div className="grid grid-cols-2 gap-2">
            {positions.map(moon => (
              <MoonStatus key={moon.name} moon={moon} />
            ))}
          </div>

          {/* Events timeline */}
          {events.length > 0 && (
            <div className="pt-3 border-t border-night-700">
              <h4 className="text-sm font-medium text-white mb-2">Tonight's Events</h4>
              <div className="space-y-2">
                {events.map(event => (
                  <EventItem
                    key={`${event.type}-${event.moon}-${event.time.getTime()}`}
                    event={event}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MoonPositionDiagram({ positions }: { positions: GalileanMoonPosition[] }) {
  // Calculate scale dynamically to fit all moons
  const maxDist = Math.max(...positions.map(p => Math.sqrt(p.x * p.x + p.y * p.y)), 10);
  const scale = Math.min(8, 100 / maxDist); // Scale to fit within ~100px from center
  const centerX = 120;
  const centerY = 40;
  const jupiterRadius = 10;

  // Moon colors
  const moonColors: Record<string, string> = {
    Io: '#ffcc00',
    Europa: '#c0c0c0',
    Ganymede: '#d4a373',
    Callisto: '#8b8b8b',
  };

  return (
    <div className="bg-night-800 rounded-lg p-4">
      <svg
        width="100%"
        height="80"
        viewBox="0 0 240 80"
        className="mx-auto"
        aria-labelledby="jupiter-moons-title"
      >
        <title id="jupiter-moons-title">Jupiter and Galilean Moons Position Diagram</title>
        {/* Jupiter */}
        <circle
          cx={centerX}
          cy={centerY}
          r={jupiterRadius}
          fill="#d4a373"
          stroke="#c9a96f"
          strokeWidth="1"
        />
        {/* Jupiter bands */}
        <line
          x1={centerX - jupiterRadius + 2}
          y1={centerY - 3}
          x2={centerX + jupiterRadius - 2}
          y2={centerY - 3}
          stroke="#b89060"
          strokeWidth="2"
        />
        <line
          x1={centerX - jupiterRadius + 2}
          y1={centerY + 3}
          x2={centerX + jupiterRadius - 2}
          y2={centerY + 3}
          stroke="#b89060"
          strokeWidth="2"
        />

        {/* Moons */}
        {positions.map(moon => {
          // x is positive west, negative east
          // For direct view (as seen with naked eye or smart telescope): east is left, west is right
          const moonX = centerX + moon.x * scale;
          const moonY = centerY - moon.y * scale;
          const color = moonColors[moon.name];
          const isBehind = moon.z > 0;
          const isTransiting = moon.isTransiting;

          return (
            <g key={moon.name}>
              {/* Moon dot */}
              <circle
                cx={moonX}
                cy={moonY}
                r={4}
                fill={color}
                opacity={isBehind ? 0.4 : 1}
                stroke={isTransiting ? '#fff' : 'none'}
                strokeWidth={isTransiting ? 1 : 0}
              />
              {/* Label */}
              <text
                x={moonX}
                y={moonY + 14}
                textAnchor="middle"
                className="text-[8px] fill-gray-400"
              >
                {moon.name.charAt(0)}
              </text>
              {/* Shadow indicator */}
              {moon.shadowOnJupiter && (
                <circle
                  cx={centerX + moon.x * scale * 0.9}
                  cy={centerY}
                  r={2}
                  fill="#000"
                  opacity={0.8}
                />
              )}
            </g>
          );
        })}

        {/* Direction labels */}
        <text x={20} y={centerY + 4} className="text-[8px] fill-gray-500">
          E
        </text>
        <text x={220} y={centerY + 4} className="text-[8px] fill-gray-500">
          W
        </text>
      </svg>
      <p className="text-xs text-gray-500 text-center mt-2">
        Direct view (as seen with naked eye or smart telescope)
      </p>
    </div>
  );
}

function MoonStatus({ moon }: { moon: GalileanMoonPosition }) {
  const distance = Math.sqrt(moon.x * moon.x + moon.y * moon.y).toFixed(1);
  const direction = moon.x > 0 ? 'west' : 'east';
  const isBehind = moon.z > 0;

  return (
    <div className="bg-night-800 rounded-lg p-2">
      <div className="flex items-center gap-2">
        <Circle
          className={`w-3 h-3 ${
            moon.isTransiting
              ? 'fill-yellow-400 text-yellow-400'
              : moon.shadowOnJupiter
                ? 'fill-orange-400 text-orange-400'
                : 'fill-gray-400 text-gray-400'
          }`}
        />
        <span className="text-sm text-white">{moon.name}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {distance} Rj {direction}
        {isBehind && ' (behind)'}
      </p>
      {moon.isTransiting && <span className="text-xs text-yellow-400">Transit in progress</span>}
      {moon.shadowOnJupiter && <span className="text-xs text-orange-400">Shadow visible</span>}
    </div>
  );
}

function EventItem({ event }: { event: GalileanMoonEvent }) {
  const typeColors: Record<string, string> = {
    transit_start: 'text-yellow-400',
    transit_end: 'text-yellow-400',
    shadow_start: 'text-orange-400',
    shadow_end: 'text-orange-400',
  };

  return (
    <div className="flex items-center justify-between bg-night-800 rounded-lg px-3 py-2">
      <span className={`text-sm ${typeColors[event.type]}`}>
        {describeGalileanMoonEvent(event)}
      </span>
      <span className="text-xs text-gray-500">{formatTime(event.time)}</span>
    </div>
  );
}
