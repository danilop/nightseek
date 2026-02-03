import { AlertTriangle, Orbit } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
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
    <Card>
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
    </Card>
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
          {neo.isPotentiallyHazardous && <Badge variant="danger">PHA</Badge>}
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
  const config: Record<
    string,
    { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'danger' }
  > = {
    tiny: { label: 'Tiny', variant: 'default' },
    small: { label: 'Small', variant: 'info' },
    medium: { label: 'Medium', variant: 'success' },
    large: { label: 'Large', variant: 'warning' },
    giant: { label: 'Giant', variant: 'danger' },
  };

  const { label, variant } = config[category];

  return <Badge variant={variant}>{label}</Badge>;
}
