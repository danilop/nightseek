import { AlertTriangle, Orbit } from 'lucide-react';
import { formatDiameter, getDistanceDescription, getSizeCategory } from '@/lib/nasa/neows';
import type { NeoCloseApproach } from '@/types';

interface CloseApproachCardProps {
  approaches: NeoCloseApproach[];
}

export default function CloseApproachCard({ approaches }: CloseApproachCardProps) {
  if (approaches.length === 0) {
    return null;
  }

  return (
    <div className="bg-night-900 rounded-xl border border-night-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-night-700">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Orbit className="w-4 h-4 text-amber-400" />
          Asteroid Close Approaches
          <span className="text-xs text-gray-400 font-normal ml-1">
            ({approaches.length} tonight)
          </span>
        </h3>
      </div>
      <div className="p-4 space-y-3">
        {approaches.slice(0, 5).map(neo => (
          <NeoCard key={neo.neoId} neo={neo} />
        ))}
        {approaches.length > 5 && (
          <p className="text-xs text-gray-500 text-center">
            +{approaches.length - 5} more close approaches
          </p>
        )}
      </div>
      <div className="px-4 py-2 border-t border-night-700 bg-night-800/50">
        <p className="text-xs text-gray-500">1 lunar distance = 384,400 km (distance to Moon)</p>
      </div>
    </div>
  );
}

interface NeoCardProps {
  neo: NeoCloseApproach;
}

function NeoCard({ neo }: NeoCardProps) {
  const sizeCategory = getSizeCategory(neo.estimatedDiameterKm);

  // Color coding based on distance
  const getDistanceColor = (ld: number) => {
    if (ld < 1) return 'text-red-400 bg-red-500/10 border-red-500/30';
    if (ld < 5) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-gray-300 bg-night-800';
  };

  const distanceColor = getDistanceColor(neo.missDistanceLunarDistances);

  return (
    <div className={`p-3 rounded-lg border ${distanceColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {neo.isPotentiallyHazardous && (
            <span title="Potentially Hazardous Asteroid">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            </span>
          )}
          <span className="text-white font-medium truncate" title={neo.name}>
            {neo.name}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {neo.isPotentiallyHazardous && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">PHA</span>
          )}
          <SizeBadge category={sizeCategory} />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-gray-500">Distance: </span>
          <span className="text-gray-300">{neo.missDistanceLunarDistances.toFixed(1)} LD</span>
        </div>
        <div>
          <span className="text-gray-500">Size: </span>
          <span className="text-gray-300">{formatDiameter(neo.estimatedDiameterKm)}</span>
        </div>
        <div>
          <span className="text-gray-500">Speed: </span>
          <span className="text-gray-300">
            {Math.round(neo.relativeVelocityKmh).toLocaleString()} km/h
          </span>
        </div>
        <div>
          <span className="text-gray-500">Mag: </span>
          <span className="text-gray-300">H {neo.absoluteMagnitude.toFixed(1)}</span>
        </div>
      </div>

      {neo.missDistanceLunarDistances < 5 && (
        <p className="text-xs text-gray-400 mt-2">
          {getDistanceDescription(neo.missDistanceLunarDistances)}
        </p>
      )}
    </div>
  );
}

interface SizeBadgeProps {
  category: 'tiny' | 'small' | 'medium' | 'large' | 'giant';
}

function SizeBadge({ category }: SizeBadgeProps) {
  const config = {
    tiny: { label: 'Tiny', className: 'bg-gray-500/20 text-gray-400' },
    small: { label: 'Small', className: 'bg-blue-500/20 text-blue-400' },
    medium: { label: 'Medium', className: 'bg-green-500/20 text-green-400' },
    large: { label: 'Large', className: 'bg-amber-500/20 text-amber-400' },
    giant: { label: 'Giant', className: 'bg-red-500/20 text-red-400' },
  };

  const { label, className } = config[category];

  return <span className={`text-xs px-1.5 py-0.5 rounded ${className}`}>{label}</span>;
}
