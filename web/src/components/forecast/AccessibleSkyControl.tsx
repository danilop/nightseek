import { Compass, RotateCcw } from 'lucide-react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useRef, useState } from 'react';
import { type CompassAssistState, useCompassAssist } from '@/hooks/useCompassAssist';
import {
  cycleSectorMinAltitude,
  getSectorAltitudeLabel,
  getSectorFillClass,
  getSectorTextClass,
  HORIZON_ALTITUDE_LEVELS,
  HORIZON_SECTOR_CONFIGS,
  type HorizonAltitudeLevel,
} from '@/lib/utils/horizon-profile';
import type { HorizonProfile, HorizonSectorLabel } from '@/types';

interface AccessibleSkyControlProps {
  horizonProfile: HorizonProfile;
  onSetMinimumAltitude: (minimumAltitude: number) => void;
  onSetSectorAltitude: (sectorLabel: HorizonSectorLabel, minAltitude: HorizonAltitudeLevel) => void;
  onReset: () => void;
}

/** Horizontal gridlines drawn behind the skyline. */
const GRID_DEGREES = [15, 30, 45, 60, 75] as const;
const LABELLED_DEGREES = [0, 30, 60, 90] as const;
const MAX_ALTITUDE = 90;

/**
 * Compact in-column label. A 320px viewport leaves each column about 34px, too
 * narrow for "Blocked" — the full wording stays in `aria-valuetext`.
 */
function getSectorChipLabel(minAltitude: number): string {
  return minAltitude >= MAX_ALTITUDE ? '✕' : `${minAltitude}°`;
}

function toPercent(minAltitude: number): number {
  return Math.max(0, Math.min((minAltitude / MAX_ALTITUDE) * 100, 100));
}

/** Nearest configurable level to a raw altitude, used when tapping a column. */
function snapToLevel(altitude: number): HorizonAltitudeLevel {
  return HORIZON_ALTITUDE_LEVELS.reduce((closest, level) =>
    Math.abs(level - altitude) < Math.abs(closest - altitude) ? level : closest
  );
}

function stepLevel(current: number, direction: 1 | -1): HorizonAltitudeLevel | null {
  const index = HORIZON_ALTITUDE_LEVELS.indexOf(current as HorizonAltitudeLevel);
  const currentIndex = index === -1 ? HORIZON_ALTITUDE_LEVELS.indexOf(snapToLevel(current)) : index;
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= HORIZON_ALTITUDE_LEVELS.length) return null;
  return HORIZON_ALTITUDE_LEVELS[nextIndex];
}

/** Keys that move focus between directions rather than change a value. */
const NAVIGATION_KEY_OFFSETS: Record<string, number | undefined> = {
  ArrowLeft: -1,
  ArrowRight: 1,
};

/**
 * The level a key should apply: `undefined` when the key is not a value key,
 * `null` when the key is a value key but the level cannot move any further.
 */
function resolveLevelForKey(key: string, current: number): HorizonAltitudeLevel | null | undefined {
  switch (key) {
    case 'ArrowUp':
    case 'PageUp':
      return stepLevel(current, 1);
    case 'ArrowDown':
    case 'PageDown':
      return stepLevel(current, -1);
    case 'Home':
      return 0;
    case 'End':
      return 90;
    case 'Enter':
    case ' ':
      return cycleSectorMinAltitude(current) as HorizonAltitudeLevel;
    default:
      return undefined;
  }
}

function getCompassStatusText(
  state: CompassAssistState,
  accuracy: number | null,
  hasHeading: boolean
): string {
  switch (state) {
    case 'tracking':
      if (!hasHeading) return 'Move the phone slowly until a direction locks in.';
      return `Direction follows your phone${accuracy === null ? '' : ` · ±${Math.round(accuracy)}° reported accuracy`}. Device headings can reference magnetic north; verify the sector against true north.`;
    case 'requesting':
      return 'Waiting for motion/orientation permission…';
    case 'denied':
      return 'Motion/orientation access was denied. You can still select directions manually.';
    case 'error':
      return 'Compass heading is unavailable. You can still select directions manually.';
    default:
      return 'Directions use true-north astronomical azimuth. Set them manually, or use the phone compass as an approximate aid.';
  }
}

function getCompassStatusClass(state: CompassAssistState): string {
  if (state === 'tracking') return 'text-sky-300';
  if (state === 'denied' || state === 'error') return 'text-amber-300';
  return 'text-gray-500';
}

function getCompassButtonLabel(state: CompassAssistState): string {
  if (state === 'tracking') return 'Stop compass';
  if (state === 'requesting') return 'Waiting…';
  return 'Use phone compass';
}

export default function AccessibleSkyControl({
  horizonProfile,
  onSetMinimumAltitude,
  onSetSectorAltitude,
  onReset,
}: AccessibleSkyControlProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const columnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const draggingIndexRef = useRef<number | null>(null);
  /** Last level emitted during the current drag, so a drag fires once per step. */
  const lastEmittedLevelRef = useRef<number | null>(null);
  const {
    accuracy,
    state: compassState,
    stop,
    toggle,
    trackedSectorIndex,
  } = useCompassAssist(setActiveIndex);
  const showCompassButton = compassState !== 'unsupported';

  const getSector = (label: HorizonSectorLabel) =>
    horizonProfile.sectors.find(candidate => candidate.label === label);

  const focusColumn = (index: number) => {
    if (compassState === 'tracking') stop();
    setActiveIndex(index);
    columnRefs.current[index]?.focus();
  };

  /** Altitude the pointer is over, snapped to a configurable level. */
  const levelFromPointer = (element: HTMLElement, clientY: number): HorizonAltitudeLevel | null => {
    const rect = element.getBoundingClientRect();
    // jsdom (and a detached element) reports a zero-height box.
    if (rect.height === 0) return null;
    const fromBottom = 1 - (clientY - rect.top) / rect.height;
    return snapToLevel(Math.max(0, Math.min(1, fromBottom)) * MAX_ALTITUDE);
  };

  const applyPointerLevel = (
    event: ReactPointerEvent<HTMLDivElement>,
    label: HorizonSectorLabel,
    current: number
  ) => {
    const level = levelFromPointer(event.currentTarget, event.clientY);
    if (level === null || level === current || level === lastEmittedLevelRef.current) return;
    lastEmittedLevelRef.current = level;
    onSetSectorAltitude(label, level);
  };

  const handlePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    index: number,
    label: HorizonSectorLabel,
    current: number
  ) => {
    // Touch is tap-only: `touch-action: pan-y` keeps the page scrollable, and a
    // vertical drag would fight that gesture.
    lastEmittedLevelRef.current = null;
    if (event.pointerType !== 'touch') {
      draggingIndexRef.current = index;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    focusColumn(index);
    applyPointerLevel(event, label, current);
  };

  const handlePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    index: number,
    label: HorizonSectorLabel,
    current: number
  ) => {
    if (draggingIndexRef.current !== index) return;
    applyPointerLevel(event, label, current);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingIndexRef.current = null;
    lastEmittedLevelRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
    label: HorizonSectorLabel,
    current: number
  ) => {
    const lastIndex = HORIZON_SECTOR_CONFIGS.length - 1;
    const focusOffset = NAVIGATION_KEY_OFFSETS[event.key];

    if (focusOffset !== undefined) {
      event.preventDefault();
      focusColumn((index + focusOffset + lastIndex + 1) % (lastIndex + 1));
      return;
    }

    const next = resolveLevelForKey(event.key, current);
    if (next === undefined) return;

    event.preventDefault();
    if (next !== null && next !== current) onSetSectorAltitude(label, next);
  };

  return (
    <section
      className="rounded-xl border border-night-700 bg-night-900 p-3 sm:p-4"
      aria-labelledby="sky-access-heading"
    >
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-400" />
            <h4 id="sky-access-heading" className="font-medium text-sm text-white">
              Sky access
            </h4>
          </div>
          <p className="mt-1 max-w-2xl text-gray-400 text-xs">
            Set one minimum imaging altitude for the whole sky, then raise the skyline where trees,
            buildings, or hills block the view.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:shrink-0">
          {showCompassButton ? (
            <button
              type="button"
              onClick={() => void toggle()}
              disabled={compassState === 'requesting'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-sky-200 text-xs transition-colors hover:bg-sky-500/15 disabled:cursor-wait disabled:opacity-70"
            >
              <Compass className="h-3.5 w-3.5" />
              {getCompassButtonLabel(compassState)}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-night-800 px-2.5 py-1.5 text-gray-300 text-xs transition-colors hover:bg-night-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-night-700/80 bg-night-950/50 p-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="minimum-target-altitude" className="font-medium text-gray-200 text-sm">
            Minimum target altitude
          </label>
          <output
            htmlFor="minimum-target-altitude"
            className="min-w-12 rounded-md bg-sky-500/10 px-2 py-1 text-center font-semibold text-sky-300 text-sm"
          >
            {horizonProfile.minimumAltitude}°
          </output>
        </div>
        <input
          id="minimum-target-altitude"
          type="range"
          min="0"
          max="60"
          step="5"
          value={horizonProfile.minimumAltitude}
          onChange={event => onSetMinimumAltitude(Number(event.target.value))}
          className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-lg bg-night-700 accent-sky-500"
        />
        <div className="mt-1 flex justify-between text-[11px] text-gray-500">
          <span>0° horizon</span>
          <span>30° balanced</span>
          <span>60° best quality</span>
        </div>
      </div>

      <p id="sky-access-instructions" className="sr-only">
        Each direction is a column of the skyline around you. Click or tap a column at the height
        your view is blocked, or use the up and down arrow keys. Left and right arrows move between
        directions, and Enter cycles through the levels.
      </p>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-medium text-gray-300 text-xs">Skyline around you</span>
          <span className="text-gray-500 text-xs">Height blocked in each direction</span>
        </div>

        <div className="flex gap-1.5">
          {/* Altitude axis — dropped on the narrowest phones to keep the
              columns comfortably wide. */}
          <div className="relative xs:block hidden w-6 shrink-0" aria-hidden="true">
            <div className="h-36 sm:h-40">
              {LABELLED_DEGREES.map(degrees => (
                <span
                  key={degrees}
                  className="absolute right-0 translate-y-1/2 text-[10px] text-gray-500"
                  style={{ bottom: `${toPercent(degrees)}%` }}
                >
                  {degrees}°
                </span>
              ))}
            </div>
          </div>

          <div className="relative h-36 min-w-0 flex-1 select-none sm:h-40">
            <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-t from-night-800/60 to-transparent" />

            {GRID_DEGREES.map(degrees => (
              <div
                key={degrees}
                className="pointer-events-none absolute inset-x-0 border-night-700/50 border-t"
                style={{ bottom: `${toPercent(degrees)}%` }}
              />
            ))}

            {horizonProfile.minimumAltitude > 0 && (
              <div
                data-testid="whole-sky-minimum"
                className="pointer-events-none absolute inset-x-0 z-20 border-indigo-300 border-t border-dashed"
                style={{ bottom: `${toPercent(horizonProfile.minimumAltitude)}%` }}
              >
                <span className="absolute -top-4 right-0 rounded bg-night-950/70 px-1 text-[10px] text-indigo-300">
                  {horizonProfile.minimumAltitude}°
                </span>
              </div>
            )}

            <div
              role="group"
              aria-label="Horizon obstruction by direction"
              className="absolute inset-0 grid grid-cols-8 overflow-hidden rounded-lg ring-1 ring-white/10"
            >
              {HORIZON_SECTOR_CONFIGS.map((config, index) => {
                const minAltitude = getSector(config.label)?.minAltitude ?? 0;
                const isTracked = index === trackedSectorIndex;

                return (
                  <div
                    key={config.label}
                    ref={element => {
                      columnRefs.current[index] = element;
                    }}
                    role="slider"
                    tabIndex={index === activeIndex ? 0 : -1}
                    aria-label={`${config.label} obstruction${isTracked ? ', aligned with phone heading' : ''}`}
                    aria-orientation="vertical"
                    aria-valuemin={0}
                    aria-valuemax={MAX_ALTITUDE}
                    aria-valuenow={minAltitude}
                    aria-valuetext={getSectorAltitudeLabel(minAltitude)}
                    aria-describedby="sky-access-instructions"
                    data-blocked={minAltitude >= MAX_ALTITUDE}
                    style={{ touchAction: 'pan-y' }}
                    onPointerDown={event =>
                      handlePointerDown(event, index, config.label, minAltitude)
                    }
                    onPointerMove={event =>
                      handlePointerMove(event, index, config.label, minAltitude)
                    }
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onKeyDown={event => handleKeyDown(event, index, config.label, minAltitude)}
                    className={`relative cursor-ns-resize border-night-950/60 border-r last:border-r-0 focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-sky-400/70 focus-visible:ring-inset ${
                      isTracked ? 'z-30 ring-2 ring-sky-400/60 ring-inset' : ''
                    }`}
                  >
                    <div
                      data-testid={`sector-fill-${config.label}`}
                      className={`pointer-events-none absolute inset-x-0 bottom-0 ${getSectorFillClass(minAltitude)}`}
                      style={{ height: `${toPercent(minAltitude)}%` }}
                    />
                    {minAltitude > 0 && (
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-x-0 bottom-1 overflow-hidden text-center text-[10px] ${getSectorTextClass(minAltitude)}`}
                      >
                        {getSectorChipLabel(minAltitude)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-1 flex gap-1.5">
          <div className="xs:block hidden w-6 shrink-0" aria-hidden="true" />
          <div className="grid min-w-0 flex-1 grid-cols-8 text-center">
            {HORIZON_SECTOR_CONFIGS.map(config => (
              <span
                key={config.label}
                className="font-semibold text-[11px] text-gray-300 tracking-[0.08em]"
              >
                {config.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showCompassButton ? (
        <p className={`mt-3 text-xs ${getCompassStatusClass(compassState)}`}>
          {getCompassStatusText(compassState, accuracy, trackedSectorIndex !== null)}
        </p>
      ) : null}
    </section>
  );
}
