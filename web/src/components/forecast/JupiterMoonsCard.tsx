import { GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, ToggleChevron } from '@/components/ui/Card';
import Tooltip from '@/components/ui/Tooltip';
import { useUIState } from '@/hooks/useUIState';
import { describeGalileanMoonEvent } from '@/lib/astronomy/galilean-moons';
import { formatTime, getNightLabel } from '@/lib/utils/format';
import type { GalileanMoonEvent, GalileanMoonPosition } from '@/types';

interface JupiterMoonsCardProps {
  positions: GalileanMoonPosition[];
  events: GalileanMoonEvent[];
  latitude: number;
  nightDate: Date;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

function getCollapsedPreview(
  positions: GalileanMoonPosition[],
  events: GalileanMoonEvent[]
): string {
  // If events exist, show the first 1-2 briefly
  if (events.length > 0) {
    return events
      .slice(0, 2)
      .map(e => {
        const shortType =
          e.type === 'transit_start'
            ? 'transit'
            : e.type === 'shadow_start'
              ? 'shadow'
              : e.type === 'transit_end'
                ? 'transit end'
                : 'shadow end';
        return `${e.moon} ${shortType} ${formatTime(e.time)}`;
      })
      .join(', ');
  }

  // No events: show E/W positions
  return positions.map(m => `${m.name} ${m.x > 0 ? 'W' : 'E'}`).join(', ');
}

export default function JupiterMoonsCard({
  positions,
  events,
  latitude,
  nightDate,
  dragHandleProps,
}: JupiterMoonsCardProps) {
  const { jupiterMoonsExpanded, setJupiterMoonsExpanded } = useUIState();
  const expanded = jupiterMoonsExpanded;
  const nightLabel = getNightLabel(nightDate);

  const hasActiveEvents =
    events.length > 0 || positions.some(p => p.isTransiting || p.shadowOnJupiter);

  return (
    <Card>
      <div className="flex items-center">
        {/* Drag handle */}
        {dragHandleProps && (
          <button
            type="button"
            className="cursor-grab touch-none px-2 py-3 text-gray-500 hover:text-gray-300 active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setJupiterMoonsExpanded(!expanded)}
          className={`flex-1 ${dragHandleProps ? 'pl-0' : 'pl-4'} flex items-center justify-between border-night-700 border-b py-3 pr-4 transition-colors hover:bg-night-800`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">&#x2643;</span>
            <h3 className="font-semibold text-white">Jupiter's Galilean Moons</h3>
            {hasActiveEvents && (
              <Badge variant="warning" className="ml-1 rounded-full">
                Events {nightLabel}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!expanded && (
              <span className="hidden text-gray-500 text-sm sm:block">
                {getCollapsedPreview(positions, events)}
              </span>
            )}
            <ToggleChevron expanded={expanded} className="h-4 w-4 text-gray-400" />
          </div>
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 p-4">
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
            <div className="border-night-700 border-t pt-3">
              <h4 className="mb-2 font-medium text-sm text-white">
                {getNightLabel(nightDate, true)} Events
              </h4>
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
    <div className="rounded-lg bg-night-800 p-4">
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
                className="fill-gray-400 text-[8px]"
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
        <text x={20} y={centerY + 4} className="fill-gray-500 text-[8px]">
          {leftLabel}
        </text>
        <text x={220} y={centerY + 4} className="fill-gray-500 text-[8px]">
          {rightLabel}
        </text>
      </svg>
      <p className="mt-2 text-center text-gray-500 text-xs">
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
    <div className="rounded-lg bg-night-800 p-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{
            backgroundColor: moonColor,
            boxShadow: moon.isTransiting ? '0 0 4px #fff' : undefined,
            border: moon.shadowOnJupiter ? '1px solid #f97316' : undefined,
            opacity: moon.isOccluded ? 0.4 : 1,
          }}
        />
        <span className="text-sm text-white">{moon.name}</span>
      </div>
      <p className="mt-1 text-gray-400 text-xs">
        {distance}{' '}
        <Tooltip content="Rj = Jupiter Radii. Distance from Jupiter's center measured in units of Jupiter's radius (71,492 km).">
          <span className="border-gray-500 border-b border-dotted">Rj</span>
        </Tooltip>{' '}
        {direction}
        {moon.isOccluded && (
          <>
            {' '}
            <Tooltip content="Moon is currently hidden behind Jupiter's disk (occultation).">
              <span className="border-gray-500 border-b border-dotted">(occluded)</span>
            </Tooltip>
          </>
        )}
      </p>
      {moon.isTransiting && (
        <Tooltip content="The moon is crossing in front of Jupiter's disk as seen from Earth.">
          <span className="border-yellow-400/50 border-b border-dotted text-xs text-yellow-400">
            Transit in progress
          </span>
        </Tooltip>
      )}
      {moon.shadowOnJupiter && (
        <Tooltip content="The moon's shadow is visible on Jupiter's cloud tops.">
          <span className="border-orange-400/50 border-b border-dotted text-orange-400 text-xs">
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
    <div className="flex items-center justify-between rounded-lg bg-night-800 px-3 py-2">
      <span className={`text-sm ${typeColors[event.type]}`}>
        {describeGalileanMoonEvent(event)}
      </span>
      <span className="text-gray-500 text-xs">{formatTime(event.time)}</span>
    </div>
  );
}
