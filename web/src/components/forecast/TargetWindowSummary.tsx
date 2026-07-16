import { Clock3 } from 'lucide-react';
import { formatDurationMinutes, formatTimeRange } from '@/lib/utils/format';
import type { TargetAccessibility } from '@/lib/utils/horizon-profile';

interface TargetWindowSummaryProps {
  accessibility: TargetAccessibility | undefined;
  timezone?: string;
  compact?: boolean;
}

export default function TargetWindowSummary({
  accessibility,
  timezone,
  compact = false,
}: TargetWindowSummaryProps) {
  const bestWindow = accessibility?.bestWindow;
  if (!accessibility || !bestWindow) return null;

  const hasMultipleWindows = accessibility.windows.length > 1;
  const label = hasMultipleWindows ? `Best of ${accessibility.windows.length}` : 'Accessible';

  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 text-xs ${compact ? 'mt-1' : 'text-gray-400'}`}
      title={
        hasMultipleWindows
          ? `${formatDurationMinutes(accessibility.accessibleMinutes)} accessible in total across ${accessibility.windows.length} windows`
          : 'Time above your minimum altitude and local horizon obstruction'
      }
    >
      <Clock3 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
      <span className="shrink-0 text-sky-300">{label}</span>
      <span className="truncate text-gray-300">
        {formatTimeRange(bestWindow.start, bestWindow.end, timezone)}
      </span>
      <span className="shrink-0 text-gray-500">
        · {formatDurationMinutes(bestWindow.durationMinutes)}
      </span>
      {hasMultipleWindows && !compact ? (
        <span className="shrink-0 text-gray-600">
          · {formatDurationMinutes(accessibility.accessibleMinutes)} total
        </span>
      ) : null}
    </div>
  );
}
