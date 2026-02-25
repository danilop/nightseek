import { AlertTriangle, Orbit } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { formatDiameter, getDistanceDescription, getSizeCategory } from '@/lib/nasa/neows';
import { getNightLabel } from '@/lib/utils/format';
import type { NeoCloseApproach } from '@/types';

interface CloseApproachCardProps {
  approaches: NeoCloseApproach[];
  nightDate: Date;
}

export default function CloseApproachCard({ approaches, nightDate }: CloseApproachCardProps) {
  if (approaches.length === 0) {
    return null;
  }

  return (
    <Card>
      <div className="border-night-700 border-b px-4 py-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Orbit className="h-4 w-4 text-amber-400" />
          Asteroid Close Approaches
          <span className="ml-1 font-normal text-gray-400 text-xs">
            ({approaches.length} {getNightLabel(nightDate)})
          </span>
        </h3>
      </div>
      <div className="space-y-3 p-4">
        {approaches.slice(0, 5).map(neo => (
          <NeoCard key={neo.neoId} neo={neo} />
        ))}
        {approaches.length > 5 && (
          <p className="text-center text-gray-500 text-xs">
            +{approaches.length - 5} more close approaches
          </p>
        )}
      </div>
      <div className="border-night-700 border-t bg-night-800/50 px-4 py-2">
        <p className="text-gray-500 text-xs">1 lunar distance = 384,400 km (distance to Moon)</p>
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
    <div className={`rounded-lg border p-3 ${distanceColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {neo.isPotentiallyHazardous && (
            <span title="Potentially Hazardous Asteroid">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
            </span>
          )}
          <span className="truncate font-medium text-white" title={neo.name}>
            {neo.name}
          </span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
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
        <p className="mt-2 text-gray-400 text-xs">
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
