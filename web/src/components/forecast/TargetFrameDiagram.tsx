import { Focus } from 'lucide-react';
import { formatFOV } from '@/lib/telescopes';
import { getFramePresentation } from '@/lib/utils/target-presentation';
import type { ObjectCategory } from '@/types';

export default function TargetFrameDiagram({
  major,
  minor,
  category,
  fov,
  compact = false,
}: {
  major: number;
  minor?: number;
  category: ObjectCategory;
  fov: { width: number; height: number } | null;
  compact?: boolean;
}) {
  const frame = getFramePresentation(major, minor, category, fov);
  if (!frame || !fov) return null;
  const geometry = frame.geometry;
  // Schematic with the long axes aligned, not a sky-orientation or rotation promise.
  const cameraW = Math.max(fov.width, fov.height);
  const cameraH = Math.min(fov.width, fov.height);
  const scale = Math.min(
    160 / Math.max(cameraW, geometry?.major ?? 0),
    90 / Math.max(cameraH, geometry?.minor ?? 0)
  );
  const label = `${frame.label}${geometry?.minorEstimated ? ' · minor axis estimated' : ''}`;
  return (
    <div
      className={compact ? 'w-24 shrink-0' : 'rounded-xl bg-night-800 p-3'}
      data-testid="target-frame"
    >
      {geometry ? (
        <svg
          viewBox="0 0 180 110"
          role="img"
          aria-label={`${frame.dimensions} · ${label}. Camera field ${formatFOV(fov.width, fov.height)}. Schematic, long axes aligned.`}
          className={compact ? 'h-16 w-full' : 'mx-auto max-h-44 w-full'}
        >
          <title>{label}</title>
          <rect
            x={(180 - cameraW * scale) / 2}
            y={(110 - cameraH * scale) / 2}
            width={cameraW * scale}
            height={cameraH * scale}
            fill="#0c4a6e"
            fillOpacity="0.3"
            stroke="#38bdf8"
            strokeWidth="1.5"
          />
          <ellipse
            cx="90"
            cy="55"
            rx={(geometry.major * scale) / 2}
            ry={(geometry.minor * scale) / 2}
            fill="#a5b4fc"
            fillOpacity="0.35"
            stroke={frame.warning ? '#fbbf24' : '#a5b4fc'}
            strokeWidth="1"
            strokeDasharray={geometry.minorEstimated ? '3 3' : undefined}
          />
        </svg>
      ) : (
        <Focus aria-hidden="true" className="mx-auto my-4 h-6 w-6 text-gray-500" />
      )}
      {!compact && (
        <p className={`font-medium text-xs ${frame.warning ? 'text-amber-300' : 'text-sky-200'}`}>
          {frame.dimensions} · {frame.label}
        </p>
      )}
      {!compact && (
        <p className="mt-1 text-gray-400 text-xs">
          FoV {formatFOV(fov.width, fov.height)}
          {geometry && ` · ≈${Math.round(geometry.spanFraction * 100)}% length span`}
          <br />
          Schematic · long axes aligned{geometry?.minorEstimated ? ' · minor axis estimated' : ''}
        </p>
      )}
    </div>
  );
}
