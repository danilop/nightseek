import { Badge } from '@/components/ui/Badge';
import { Card, ToggleChevron } from '@/components/ui/Card';
import Tooltip from '@/components/ui/Tooltip';
import { useUIState } from '@/hooks/useUIState';
import { describeGalileanMoonEvent } from '@/lib/astronomy/galilean-moons';
import { formatTime } from '@/lib/utils/format';
import type { GalileanMoonEvent, GalileanMoonPosition } from '@/types';

interface JupiterMoonsCardProps {
  positions: GalileanMoonPosition[];
  events: GalileanMoonEvent[];
  latitude: number;
}

export default function JupiterMoonsCard({ positions, events, latitude }: JupiterMoonsCardProps) {
  const { jupiterMoonsExpanded, setJupiterMoonsExpanded } = useUIState();
  const expanded = jupiterMoonsExpanded;

  const hasActiveEvents =
    events.length > 0 || positions.some(p => p.isTransiting || p.shadowOnJupiter);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setJupiterMoonsExpanded(!expanded)}
        className="w-full px-4 py-3 border-b border-night-700 flex items-center justify-between hover:bg-night-800 transition-colors"
      >
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span className="text-xl">&#x2643;</span>
          Jupiter's Galilean Moons
          {hasActiveEvents && (
            <Badge variant="warning" className="ml-2 rounded-full">
              Events Tonight
            </Badge>
          )}
        </h3>
        <ToggleChevron expanded={expanded} className="w-4 h-4 text-gray-400" />
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Visual diagram of moon positions */}
          <MoonPositionDiagram positions={positions} isNorthernHemisphere={latitude >= 0} />

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
    </Card>
  );
}

function MoonPositionDiagram({
  positions,
  isNorthernHemisphere,
}: {
  positions: GalileanMoonPosition[];
  isNorthernHemisphere: boolean;
}) {
  // Calculate scale dynamically to fit all moons
  const maxDist = Math.max(...positions.map(p => Math.sqrt(p.x * p.x + p.y * p.y)), 10);
  const scale = Math.min(8, 100 / maxDist); // Scale to fit within ~100px from center
  const centerX = 120;
  const centerY = 40;
  const jupiterRadius = 10;

  // E/W orientation depends on hemisphere:
  // Northern Hemisphere (looking south): East is left, West is right
  // Southern Hemisphere (looking north): East is right, West is left
  const leftLabel = isNorthernHemisphere ? 'E' : 'W';
  const rightLabel = isNorthernHemisphere ? 'W' : 'E';
  const viewDirection = isNorthernHemisphere ? 'looking south' : 'looking north';

  // Moon colors - realistic and distinguishable
  // Io: volcanic sulfur (golden orange)
  // Europa: icy surface (pale ice blue)
  // Ganymede: mixed rock/ice (tan)
  // Callisto: dark cratered surface (dark brown)
  const moonColors: Record<string, string> = {
    Io: '#e8a020',
    Europa: '#d0e8f8',
    Ganymede: '#c9a86c',
    Callisto: '#5a4d40',
  };

  // Moon sizes - proportional to real diameters
  // Ganymede: 5268km, Callisto: 4821km, Io: 3643km, Europa: 3122km
  const moonSizes: Record<string, number> = {
    Io: 3.5,
    Europa: 3,
    Ganymede: 5,
    Callisto: 4.5,
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
          // x is positive west, negative east in celestial coordinates
          // Northern Hemisphere (looking south): west is right (+x = right)
          // Southern Hemisphere (looking north): west is left (+x = left, so flip)
          const xMultiplier = isNorthernHemisphere ? 1 : -1;
          const moonX = centerX + moon.x * scale * xMultiplier;
          const moonY = centerY - moon.y * scale;
          const color = moonColors[moon.name];
          const radius = moonSizes[moon.name];
          const isTransiting = moon.isTransiting;

          return (
            <g key={moon.name}>
              {/* Moon dot */}
              <circle
                cx={moonX}
                cy={moonY}
                r={radius}
                fill={color}
                opacity={moon.isOccluded ? 0.4 : 1}
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
                  cx={centerX + moon.x * scale * 0.9 * xMultiplier}
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
          {leftLabel}
        </text>
        <text x={220} y={centerY + 4} className="text-[8px] fill-gray-500">
          {rightLabel}
        </text>
      </svg>
      <p className="text-xs text-gray-500 text-center mt-2">
        <Tooltip content="How Jupiter appears through a telescope or binoculars. The orientation matches what you see when looking at the sky.">
          <span>Direct view ({viewDirection})</span>
        </Tooltip>
      </p>
    </div>
  );
}

// Moon colors for status display - matches diagram
const statusMoonColors: Record<string, string> = {
  Io: '#e8a020',
  Europa: '#d0e8f8',
  Ganymede: '#c9a86c',
  Callisto: '#5a4d40',
};

function MoonStatus({ moon }: { moon: GalileanMoonPosition }) {
  const distance = Math.sqrt(moon.x * moon.x + moon.y * moon.y).toFixed(1);
  const direction = moon.x > 0 ? 'west' : 'east';
  const moonColor = statusMoonColors[moon.name];

  return (
    <div className="bg-night-800 rounded-lg p-2">
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full inline-block"
          style={{
            backgroundColor: moonColor,
            boxShadow: moon.isTransiting ? '0 0 4px #fff' : undefined,
            border: moon.shadowOnJupiter ? '1px solid #f97316' : undefined,
            opacity: moon.isOccluded ? 0.4 : 1,
          }}
        />
        <span className="text-sm text-white">{moon.name}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {distance}{' '}
        <Tooltip content="Rj = Jupiter Radii. Distance from Jupiter's center measured in units of Jupiter's radius (71,492 km).">
          <span className="border-b border-dotted border-gray-500">Rj</span>
        </Tooltip>{' '}
        {direction}
        {moon.isOccluded && (
          <>
            {' '}
            <Tooltip content="Moon is currently hidden behind Jupiter's disk (occultation).">
              <span className="border-b border-dotted border-gray-500">(occluded)</span>
            </Tooltip>
          </>
        )}
      </p>
      {moon.isTransiting && (
        <Tooltip content="The moon is crossing in front of Jupiter's disk as seen from Earth.">
          <span className="text-xs text-yellow-400 border-b border-dotted border-yellow-400/50">
            Transit in progress
          </span>
        </Tooltip>
      )}
      {moon.shadowOnJupiter && (
        <Tooltip content="The moon's shadow is visible on Jupiter's cloud tops.">
          <span className="text-xs text-orange-400 border-b border-dotted border-orange-400/50">
            Shadow visible
          </span>
        </Tooltip>
      )}
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
