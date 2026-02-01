import { useMemo } from 'react';
import Tooltip from '@/components/ui/Tooltip';
import { calculateBortle, getBortleBgClass, getBortleColorClass } from '@/lib/lightpollution';

interface BortleIndicatorProps {
  latitude: number;
  longitude: number;
}

/**
 * Displays Bortle scale indicator for light pollution at user's location.
 * Shows as a colored badge with tooltip containing full description.
 */
export default function BortleIndicator({ latitude, longitude }: BortleIndicatorProps) {
  const bortle = useMemo(() => calculateBortle(latitude, longitude), [latitude, longitude]);

  const tooltipContent = `${bortle.label} (Bortle ${bortle.value})\n\nNaked eye limiting magnitude: ${bortle.nakedEyeLimitingMag.toFixed(1)}\n\n${bortle.description}`;

  return (
    <Tooltip content={tooltipContent} maxWidth={300}>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getBortleBgClass(bortle.value)} ${getBortleColorClass(bortle.value)}`}
      >
        <BortleIcon />
        <span>Bortle {bortle.value}</span>
      </span>
    </Tooltip>
  );
}

function BortleIcon() {
  return (
    <svg
      className="w-3 h-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" opacity={0.5} />
      <circle cx="12" cy="12" r="11" opacity={0.25} />
    </svg>
  );
}
