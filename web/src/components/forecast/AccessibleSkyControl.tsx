import { Compass, RotateCcw } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  getSectorAltitudeLabel,
  getSectorToneClass,
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

type CompassAssistState = 'unsupported' | 'idle' | 'requesting' | 'tracking' | 'denied' | 'error';

interface BrowserDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassAccuracy?: number;
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

const SECTOR_WIDTH_DEGREES = 45;
const SECTOR_HYSTERESIS_DEGREES = 3;

function normalizeHeading(heading: number): number {
  const normalized = heading % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function angularDistance(first: number, second: number): number {
  return Math.abs(((first - second + 540) % 360) - 180);
}

function getSectorIndexFromHeading(heading: number, currentSectorIndex: number | null): number {
  const normalizedHeading = normalizeHeading(heading);

  if (currentSectorIndex !== null) {
    const currentCenter = HORIZON_SECTOR_CONFIGS[currentSectorIndex].centerAzimuth;
    if (
      angularDistance(normalizedHeading, currentCenter) <=
      SECTOR_WIDTH_DEGREES / 2 + SECTOR_HYSTERESIS_DEGREES
    ) {
      return currentSectorIndex;
    }
  }

  return Math.round(normalizedHeading / SECTOR_WIDTH_DEGREES) % HORIZON_SECTOR_CONFIGS.length;
}

function getScreenOrientationAngle(): number {
  const screenAngle = window.screen.orientation?.angle;
  if (typeof screenAngle === 'number') return screenAngle;

  const legacyAngle = (window as Window & { orientation?: number }).orientation;
  return typeof legacyAngle === 'number' ? legacyAngle : 0;
}

function getHeadingFromOrientationEvent(event: BrowserDeviceOrientationEvent): {
  accuracy: number | null;
  heading: number | null;
} {
  const screenAngle = getScreenOrientationAngle();

  if (
    typeof event.webkitCompassHeading === 'number' &&
    Number.isFinite(event.webkitCompassHeading)
  ) {
    return {
      heading: normalizeHeading(event.webkitCompassHeading + screenAngle),
      accuracy:
        typeof event.webkitCompassAccuracy === 'number' &&
        Number.isFinite(event.webkitCompassAccuracy)
          ? event.webkitCompassAccuracy
          : null,
    };
  }

  if (event.absolute && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
    return {
      heading: normalizeHeading(360 - event.alpha + screenAngle),
      accuracy: null,
    };
  }

  return { heading: null, accuracy: null };
}

function getBlockedHeightPercent(minAltitude: number): number {
  return Math.max(0, Math.min((minAltitude / 90) * 100, 100));
}

function getCompassStatusText(
  state: CompassAssistState,
  accuracy: number | null,
  hasHeading: boolean
): string {
  switch (state) {
    case 'tracking':
      if (!hasHeading) return 'Move the phone slowly until a direction locks in.';
      return `Direction follows your phone${accuracy === null ? '' : ` · ±${Math.round(accuracy)}° reported accuracy`}.`;
    case 'requesting':
      return 'Waiting for motion/orientation permission…';
    case 'denied':
      return 'Motion/orientation access was denied. You can still select directions manually.';
    case 'error':
      return 'Compass heading is unavailable. You can still select directions manually.';
    default:
      return 'Select a direction below, or use your phone compass to point at it.';
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

function removeOrientationListeners(listener: ((event: Event) => void) | null): void {
  if (listener === null) return;
  window.removeEventListener('deviceorientation', listener);
  window.removeEventListener('deviceorientationabsolute', listener);
}

function useCompassAssist(onDirectionChange: (sectorIndex: number) => void) {
  const orientationListenerRef = useRef<((event: Event) => void) | null>(null);
  const trackedSectorIndexRef = useRef<number | null>(null);
  const [state, setState] = useState<CompassAssistState>('unsupported');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [trackedSectorIndex, setTrackedSectorIndex] = useState<number | null>(null);

  useEffect(() => {
    setState(typeof window.DeviceOrientationEvent === 'undefined' ? 'unsupported' : 'idle');
  }, []);

  const stop = (nextState: CompassAssistState = 'idle') => {
    removeOrientationListeners(orientationListenerRef.current);
    orientationListenerRef.current = null;
    trackedSectorIndexRef.current = null;
    setTrackedSectorIndex(null);
    setAccuracy(null);
    setState(nextState);
  };

  useEffect(
    () => () => {
      removeOrientationListeners(orientationListenerRef.current);
    },
    []
  );

  const toggle = async () => {
    if (state === 'tracking') {
      stop();
      return;
    }

    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setState('unsupported');
      return;
    }

    setState('requesting');
    const orientationEventClass = window.DeviceOrientationEvent as typeof DeviceOrientationEvent &
      DeviceOrientationEventWithPermission;

    try {
      const permission =
        typeof orientationEventClass.requestPermission === 'function'
          ? await orientationEventClass.requestPermission()
          : 'granted';
      if (permission !== 'granted') {
        setState('denied');
        return;
      }

      const handleOrientation = (incomingEvent: Event) => {
        const headingResult = getHeadingFromOrientationEvent(
          incomingEvent as BrowserDeviceOrientationEvent
        );
        if (headingResult.heading === null) return;

        const sectorIndex = getSectorIndexFromHeading(
          headingResult.heading,
          trackedSectorIndexRef.current
        );
        trackedSectorIndexRef.current = sectorIndex;
        setTrackedSectorIndex(sectorIndex);
        setAccuracy(headingResult.accuracy);
        onDirectionChange(sectorIndex);
      };

      orientationListenerRef.current = handleOrientation;
      window.addEventListener('deviceorientationabsolute', handleOrientation);
      window.addEventListener('deviceorientation', handleOrientation);
      setState('tracking');
    } catch {
      stop('error');
    }
  };

  return { accuracy, state, stop, toggle, trackedSectorIndex };
}

export default function AccessibleSkyControl({
  horizonProfile,
  onSetMinimumAltitude,
  onSetSectorAltitude,
  onReset,
}: AccessibleSkyControlProps) {
  const [selectedSectorIndex, setSelectedSectorIndex] = useState(0);
  const sectorButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const {
    accuracy,
    state: compassState,
    stop,
    toggle,
    trackedSectorIndex,
  } = useCompassAssist(setSelectedSectorIndex);
  const selectedConfig = HORIZON_SECTOR_CONFIGS[selectedSectorIndex];
  const selectedSector =
    horizonProfile.sectors.find(sector => sector.label === selectedConfig.label) ??
    horizonProfile.sectors[0];
  const showCompassButton = compassState !== 'unsupported';

  const selectSector = (sectorIndex: number) => {
    if (compassState === 'tracking') stop();
    setSelectedSectorIndex(sectorIndex);
  };

  const handleSectorKeyDown = (event: KeyboardEvent<HTMLButtonElement>, sectorIndex: number) => {
    const columns = window.matchMedia('(min-width: 640px)').matches ? 8 : 4;
    const offsetByKey: Partial<Record<string, number>> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -columns,
      ArrowDown: columns,
    };
    const offset = offsetByKey[event.key];
    if (offset === undefined) return;

    event.preventDefault();
    const nextIndex =
      (sectorIndex + offset + HORIZON_SECTOR_CONFIGS.length) % HORIZON_SECTOR_CONFIGS.length;
    selectSector(nextIndex);
    sectorButtonRefs.current[nextIndex]?.focus();
  };

  return (
    <section
      className="rounded-xl border border-night-700 bg-night-900 p-4"
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
            Set one minimum imaging altitude for the whole sky, then raise individual directions
            where trees, buildings, or hills block the view.
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

      {showCompassButton ? (
        <p className={`mt-3 text-xs ${getCompassStatusClass(compassState)}`}>
          {getCompassStatusText(compassState, accuracy, trackedSectorIndex !== null)}
        </p>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-medium text-gray-300 text-xs">Directional obstructions</span>
          <span className="text-gray-500 text-xs">All eight directions are shown</span>
        </div>
        <div
          className="grid grid-cols-4 gap-2 sm:grid-cols-8"
          role="group"
          aria-label="Horizon directions"
        >
          {HORIZON_SECTOR_CONFIGS.map((config, sectorIndex) => {
            const sector =
              horizonProfile.sectors.find(candidate => candidate.label === config.label) ??
              ({ ...config, minAltitude: 0 } as const);
            const isSelected = sectorIndex === selectedSectorIndex;
            const isTracked = sectorIndex === trackedSectorIndex;

            return (
              <button
                key={config.label}
                ref={element => {
                  sectorButtonRefs.current[sectorIndex] = element;
                }}
                type="button"
                onClick={() => selectSector(sectorIndex)}
                onKeyDown={event => handleSectorKeyDown(event, sectorIndex)}
                aria-pressed={isSelected}
                aria-label={`${config.label}, ${getSectorAltitudeLabel(sector.minAltitude)}${isTracked ? ', aligned with phone heading' : ''}`}
                className={`relative min-h-16 overflow-hidden rounded-xl border px-2 py-2 text-center transition-all ${getSectorToneClass(
                  sector.minAltitude
                )} ${
                  isSelected
                    ? 'ring-2 ring-sky-400/70 ring-offset-2 ring-offset-night-900'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-x-1 bottom-1 rounded-b-lg bg-night-950/60"
                  style={{ height: `${getBlockedHeightPercent(sector.minAltitude)}%` }}
                />
                <span className="relative z-10 block font-semibold text-sm tracking-[0.12em]">
                  {config.label}
                </span>
                <span className="relative z-10 mt-1 block text-[11px]">
                  {getSectorAltitudeLabel(sector.minAltitude)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-night-700/80 bg-night-950/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-gray-400 text-xs">
              {compassState === 'tracking' ? 'Pointing at' : 'Editing'}
            </span>
            <span className="ml-2 font-semibold text-sky-300 text-sm tracking-[0.14em]">
              {selectedConfig.label}
            </span>
          </div>
          <span className="text-gray-500 text-xs">
            Blocks targets below this height in {selectedConfig.label}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {HORIZON_ALTITUDE_LEVELS.map(level => {
            const isActive = selectedSector?.minAltitude === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => onSetSectorAltitude(selectedConfig.label, level)}
                aria-pressed={isActive}
                className={`rounded-lg border px-1.5 py-2 text-xs transition-colors ${
                  isActive
                    ? 'border-sky-400/40 bg-sky-500/20 text-sky-100'
                    : 'border-night-700 bg-night-900 text-gray-300 hover:bg-night-800'
                }`}
              >
                {getSectorAltitudeLabel(level)}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
