import { Moon } from 'lucide-react';
import Tooltip from '@/components/ui/Tooltip';
import {
  getMoonPhaseEmoji as getExactMoonPhaseEmoji,
  getMoonPhaseName as getExactMoonPhaseName,
} from '@/lib/astronomy/moon-phases';
import {
  formatDurationMinutes,
  formatTime,
  getMoonPhaseEmoji,
  getMoonPhaseName,
} from '@/lib/utils/format';
import type { NightInfo } from '@/types';

const LEVEL_STYLES = {
  none: 'text-green-300 bg-green-500/10',
  minimal: 'text-green-300 bg-green-500/10',
  low: 'text-sky-300 bg-sky-500/10',
  moderate: 'text-amber-300 bg-amber-500/10',
  strong: 'text-orange-300 bg-orange-500/10',
} as const;

const LEVEL_LABELS = {
  none: 'No moonlight',
  minimal: 'Minimal moonlight',
  low: 'Low moonlight',
  moderate: 'Moderate moonlight',
  strong: 'Strong moonlight',
} as const;

export default function MoonSummaryCard({
  nightInfo,
  timezone,
}: {
  nightInfo: NightInfo;
  timezone?: string;
}) {
  const phaseName = nightInfo.moonPhaseExact
    ? getExactMoonPhaseName(nightInfo.moonPhaseExact.phase)
    : getMoonPhaseName(nightInfo.moonPhase);
  const phaseEmoji = nightInfo.moonPhaseExact
    ? getExactMoonPhaseEmoji(nightInfo.moonPhaseExact.phase)
    : getMoonPhaseEmoji(nightInfo.moonPhase);
  const { moonlight } = nightInfo;
  const visibleMinutes = moonlight.visibleHours * 60;

  return (
    <div className="rounded-xl border border-night-700 bg-night-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Moon className="h-4 w-4 text-slate-300" />
          Moon &amp; Moonlight
        </h3>
        <Tooltip content="Moonlight exposure combines the illuminated fraction with how much of this observing window the Moon is actually above your horizon.">
          <span
            className={`rounded-full px-2 py-1 font-medium text-xs ${LEVEL_STYLES[moonlight.level]}`}
          >
            {LEVEL_LABELS[moonlight.level]}
          </span>
        </Tooltip>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="flex items-center gap-3">
          <span className="text-4xl" role="img" aria-label={phaseName}>
            {phaseEmoji}
          </span>
          <div>
            <p className="font-medium text-gray-100">{phaseName}</p>
            <p className="text-gray-400 text-sm">
              {Math.round(nightInfo.moonIllumination)}% illuminated
            </p>
            {nightInfo.moonPhaseExact?.isTonight && (
              <p className="text-gray-500 text-xs">
                Exact phase at {formatTime(nightInfo.moonPhaseExact.time, timezone)}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-gray-400">Moonlight exposure</span>
            <span className="text-gray-300 tabular-nums">
              {Math.round(moonlight.exposurePercent)}%
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-night-700"
            role="progressbar"
            aria-label="Moonlight exposure during observing window"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(moonlight.exposurePercent)}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-slate-600 to-slate-200"
              style={{ width: `${moonlight.exposurePercent}%` }}
            />
          </div>
          <p className="mt-2 text-gray-400 text-xs">
            {moonlight.level === 'none'
              ? 'Moon below the horizon throughout this observing window.'
              : `Moon up for ${formatDurationMinutes(visibleMinutes)}, reaching ${moonlight.maxAltitude.toFixed(0)}° altitude.`}
          </p>
          {(nightInfo.moonSet || nightInfo.moonRise) && (
            <p className="mt-1 text-gray-500 text-xs">
              {[
                nightInfo.moonSet && `Moonset ${formatTime(nightInfo.moonSet, timezone)}`,
                nightInfo.moonRise && `Next moonrise ${formatTime(nightInfo.moonRise, timezone)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
