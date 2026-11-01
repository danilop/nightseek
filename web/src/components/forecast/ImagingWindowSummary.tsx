import { formatDurationMinutes, formatTimeRange } from '@/lib/utils/format';
import type { PhotoReadyWindow } from '@/lib/utils/target-photo-windows';

export default function ImagingWindowSummary({
  window,
  weatherAvailable,
  timezone,
}: {
  window: PhotoReadyWindow | null;
  weatherAvailable: boolean;
  timezone?: string;
}) {
  return (
    <div className="space-y-1 text-xs" data-testid="imaging-window-summary">
      <p className="text-gray-400">
        {weatherAvailable ? 'Imaging window' : 'Visibility only · weather unavailable'}
      </p>
      {window ? (
        <>
          <p className="text-sky-200 tabular-nums">
            {formatTimeRange(window.start, window.end, timezone)}
          </p>
          <p className={window.durationMinutes < 120 ? 'text-amber-300' : 'text-gray-400'}>
            {formatDurationMinutes(window.durationMinutes)}
            {window.durationMinutes < 120 ? ' · short window' : ''}
          </p>
        </>
      ) : (
        <p className="text-amber-300">
          {weatherAvailable ? 'No remaining imaging window' : 'No remaining visibility window'}
        </p>
      )}
    </div>
  );
}
