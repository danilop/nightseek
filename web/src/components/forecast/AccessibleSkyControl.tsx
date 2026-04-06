import { Compass, RotateCcw } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getSectorAltitudeLabel,
  getSectorToneClass,
  HORIZON_SECTOR_CONFIGS,
} from '@/lib/utils/horizon-profile';
import type { HorizonProfile } from '@/types';

interface AccessibleSkyControlProps {
  horizonProfile: HorizonProfile;
  onCycleSector: (sectorLabel: HorizonProfile['sectors'][number]['label']) => void;
  onReset: () => void;
}

type CompassAssistState = 'unsupported' | 'idle' | 'requesting' | 'tracking' | 'denied' | 'error';

interface BrowserDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassAccuracy?: number;
  webkitCompassHeading?: number;
}

interface DeviceOrientationEventWithPermission {
  requestPermission?: (absolute?: boolean) => Promise<'granted' | 'denied'>;
}

const CARD_WIDTH = 88;
const CARD_GAP = 10;
const STEP_SIZE = CARD_WIDTH + CARD_GAP;
const LOOP_REPETITIONS = 7;

function normalizeHeading(heading: number): number {
  const normalized = heading % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function getSectorIndexFromHeading(heading: number): number {
  return Math.round(normalizeHeading(heading) / 45) % HORIZON_SECTOR_CONFIGS.length;
}

function getHeadingFromOrientationEvent(event: BrowserDeviceOrientationEvent): {
  accuracy: number | null;
  heading: number | null;
} {
  if (
    typeof event.webkitCompassHeading === 'number' &&
    Number.isFinite(event.webkitCompassHeading)
  ) {
    return {
      heading: normalizeHeading(event.webkitCompassHeading),
      accuracy:
        typeof event.webkitCompassAccuracy === 'number' &&
        Number.isFinite(event.webkitCompassAccuracy)
          ? event.webkitCompassAccuracy
          : null,
    };
  }

  if (event.absolute && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
    return {
      // Inference from the orientation spec/MDN examples: alpha is inverse compass heading.
      heading: normalizeHeading(360 - event.alpha),
      accuracy: null,
    };
  }

  return {
    heading: null,
    accuracy: null,
  };
}

function getBlockedHeightPercent(minAltitude: number): number {
  return Math.max(0, Math.min((minAltitude / 90) * 100, 100));
}

export default function AccessibleSkyControl({
  horizonProfile,
  onCycleSector,
  onReset,
}: AccessibleSkyControlProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitializedRef = useRef(false);
  const clearProgrammaticScrollTimerRef = useRef<number | null>(null);
  const programmaticScrollRef = useRef(false);
  const orientationListenerRef = useRef<((event: Event) => void) | null>(null);
  const sectorCount = HORIZON_SECTOR_CONFIGS.length;
  const middleLoop = Math.floor(LOOP_REPETITIONS / 2);
  const activeIndexRef = useRef(middleLoop * sectorCount);
  const [sidePadding, setSidePadding] = useState(CARD_WIDTH);
  const [activeIndex, setActiveIndex] = useState(middleLoop * sectorCount);
  const [compassAssistState, setCompassAssistState] = useState<CompassAssistState>('unsupported');
  const [compassAccuracy, setCompassAccuracy] = useState<number | null>(null);

  const sectors = useMemo(() => {
    const altitudeByLabel = new Map(
      horizonProfile.sectors.map(sector => [sector.label, sector.minAltitude])
    );

    return Array.from({ length: LOOP_REPETITIONS }, (_, loopIndex) =>
      HORIZON_SECTOR_CONFIGS.map((config, sectorIndex) => ({
        id: `${loopIndex}-${config.label}`,
        loopIndex,
        sectorIndex,
        label: config.label,
        minAltitude: altitudeByLabel.get(config.label) ?? 0,
      }))
    ).flat();
  }, [horizonProfile]);

  const activeSector = sectors[activeIndex] ?? sectors[middleLoop * sectorCount];
  const activeSectorLabel = activeSector?.label ?? 'N';
  const activeMinAltitude = activeSector?.minAltitude ?? 0;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const scrollToIndex = (
    targetIndex: number,
    behavior: ScrollBehavior = 'smooth',
    isProgrammatic = false
  ) => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const boundedIndex = Math.max(0, Math.min(sectors.length - 1, targetIndex));
    if (isProgrammatic) {
      programmaticScrollRef.current = true;
      if (clearProgrammaticScrollTimerRef.current !== null) {
        window.clearTimeout(clearProgrammaticScrollTimerRef.current);
      }
      clearProgrammaticScrollTimerRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = false;
        clearProgrammaticScrollTimerRef.current = null;
      }, 120);
    }
    scroller.scrollTo({
      left: boundedIndex * STEP_SIZE,
      behavior,
    });
    setActiveIndex(boundedIndex);
    activeIndexRef.current = boundedIndex;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCompassAssistState(
      typeof window.DeviceOrientationEvent === 'undefined' ? 'unsupported' : 'idle'
    );
  }, []);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || typeof ResizeObserver === 'undefined') return;

    const updatePadding = () => {
      const nextPadding = Math.max((scroller.clientWidth - CARD_WIDTH) / 2, 0);
      setSidePadding(nextPadding);
    };

    updatePadding();

    const observer = new ResizeObserver(updatePadding);
    observer.observe(scroller);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!scrollRef.current) return;

    scrollToIndex(middleLoop * sectorCount, 'auto');
    hasInitializedRef.current = true;
  }, [middleLoop, sectorCount, sectors.length]);

  const recenterIfNeeded = (index: number) => {
    const loopIndex = Math.floor(index / sectorCount);
    if (loopIndex > 1 && loopIndex < LOOP_REPETITIONS - 2) return;

    const centeredIndex = middleLoop * sectorCount + (index % sectorCount);
    if (centeredIndex === index) return;

    scrollToIndex(centeredIndex, 'auto', true);
  };

  const stopCompassAssist = (nextState: CompassAssistState = 'idle') => {
    if (typeof window !== 'undefined' && orientationListenerRef.current) {
      window.removeEventListener('deviceorientation', orientationListenerRef.current);
      window.removeEventListener('deviceorientationabsolute', orientationListenerRef.current);
    }
    orientationListenerRef.current = null;
    setCompassAssistState(nextState);
    setCompassAccuracy(null);
  };

  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && orientationListenerRef.current) {
        window.removeEventListener('deviceorientation', orientationListenerRef.current);
        window.removeEventListener('deviceorientationabsolute', orientationListenerRef.current);
      }
      if (clearProgrammaticScrollTimerRef.current !== null) {
        window.clearTimeout(clearProgrammaticScrollTimerRef.current);
      }
    },
    []
  );

  const handleScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    const rawIndex = Math.round(scroller.scrollLeft / STEP_SIZE);
    const nextIndex = Math.max(0, Math.min(sectors.length - 1, rawIndex));

    if (programmaticScrollRef.current) {
      setActiveIndex(nextIndex);
      activeIndexRef.current = nextIndex;
      return;
    }

    if (compassAssistState === 'tracking') {
      stopCompassAssist();
    }

    setActiveIndex(nextIndex);
    activeIndexRef.current = nextIndex;
    recenterIfNeeded(nextIndex);
  };

  const handleSectorPress = (_index: number, label: HorizonProfile['sectors'][number]['label']) => {
    if (compassAssistState === 'tracking') {
      stopCompassAssist();
    }

    onCycleSector(label);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const label = event.currentTarget.dataset.sectorLabel as
      | HorizonProfile['sectors'][number]['label']
      | undefined;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (compassAssistState === 'tracking') {
        stopCompassAssist();
      }
      scrollToIndex(activeIndex + 1);
      window.requestAnimationFrame(() => {
        buttonRefs.current[Math.min(activeIndex + 1, sectors.length - 1)]?.focus();
      });
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (compassAssistState === 'tracking') {
        stopCompassAssist();
      }
      scrollToIndex(activeIndex - 1);
      window.requestAnimationFrame(() => {
        buttonRefs.current[Math.max(activeIndex - 1, 0)]?.focus();
      });
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (label) {
        onCycleSector(label);
      }
    }
  };

  const handleCompassAssistToggle = async () => {
    if (compassAssistState === 'tracking') {
      stopCompassAssist();
      return;
    }

    if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') {
      setCompassAssistState('unsupported');
      return;
    }

    setCompassAssistState('requesting');

    const orientationEventClass = window.DeviceOrientationEvent as typeof DeviceOrientationEvent &
      DeviceOrientationEventWithPermission;

    try {
      if (typeof orientationEventClass.requestPermission === 'function') {
        let permissionState: 'granted' | 'denied';

        try {
          permissionState = await orientationEventClass.requestPermission(true);
        } catch {
          permissionState = await orientationEventClass.requestPermission();
        }

        if (permissionState !== 'granted') {
          setCompassAssistState('denied');
          return;
        }
      }

      const handleOrientation = (incomingEvent: Event) => {
        const { accuracy, heading } = getHeadingFromOrientationEvent(
          incomingEvent as BrowserDeviceOrientationEvent
        );

        if (heading === null) return;

        const nextIndex = middleLoop * sectorCount + getSectorIndexFromHeading(heading);
        setCompassAccuracy(accuracy);
        if (nextIndex !== activeIndexRef.current) {
          scrollToIndex(nextIndex, 'auto', true);
        }
      };

      orientationListenerRef.current = handleOrientation;
      window.addEventListener('deviceorientation', handleOrientation);
      window.addEventListener('deviceorientationabsolute', handleOrientation);
      setCompassAssistState('tracking');
    } catch {
      stopCompassAssist('error');
    }
  };

  const compassStatusText =
    compassAssistState === 'tracking'
      ? `Following device heading${compassAccuracy !== null ? ` (${Math.round(compassAccuracy)}° accuracy)` : ''}`
      : compassAssistState === 'requesting'
        ? 'Waiting for browser permission…'
        : compassAssistState === 'denied'
          ? 'Motion/orientation access was denied.'
          : compassAssistState === 'error'
            ? 'Compass heading is unavailable on this device.'
            : 'Use your phone heading to align the center marker with the horizon.';

  const showCompassButton = compassAssistState !== 'unsupported';

  return (
    <div className="rounded-lg border border-night-700 bg-night-900 p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-sky-400" />
            <h4 className="font-medium text-sm text-white">Accessible sky</h4>
          </div>
          <p className="mt-1 text-gray-400 text-xs">
            Swipe across the horizon, or use arrow keys on desktop. Tap any visible direction to
            cycle its minimum visible altitude.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {showCompassButton ? (
            <button
              type="button"
              onClick={() => void handleCompassAssistToggle()}
              disabled={compassAssistState === 'requesting'}
              className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1.5 text-sky-200 text-xs transition-colors hover:bg-sky-500/15 disabled:cursor-wait disabled:opacity-70"
            >
              <Compass className="h-3.5 w-3.5" />
              {compassAssistState === 'tracking'
                ? 'Stop compass'
                : compassAssistState === 'requesting'
                  ? 'Waiting...'
                  : 'Use phone compass'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-md bg-night-800 px-2.5 py-1.5 text-gray-300 text-xs transition-colors hover:bg-night-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/8 px-3 py-1.5">
          <span className="text-[11px] uppercase tracking-[0.16em] text-sky-300/80">Centered</span>
          <span className="font-semibold text-sky-200 text-sm">{activeSectorLabel}</span>
          <span
            className={`rounded-full border px-2 py-0.5 font-medium text-[11px] ${getSectorToneClass(activeMinAltitude)}`}
          >
            {getSectorAltitudeLabel(activeMinAltitude)}
          </span>
        </div>
        <p className="text-gray-500 text-xs">
          The center line shows the current heading reference.
        </p>
      </div>

      {showCompassButton ? (
        <p
          className={`mb-3 text-xs ${
            compassAssistState === 'tracking'
              ? 'text-sky-300'
              : compassAssistState === 'denied' || compassAssistState === 'error'
                ? 'text-amber-300'
                : 'text-gray-500'
          }`}
        >
          {compassStatusText}
        </p>
      ) : null}

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-3 left-1/2 z-10 w-px -translate-x-1/2 bg-sky-400/35" />
        <div className="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded-full border border-sky-400/20 bg-night-950/90 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-sky-300/80">
          Heading
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-night-900 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-night-900 to-transparent" />

        <div
          ref={scrollRef}
          className="snap-x snap-mandatory overflow-x-auto scroll-smooth py-2"
          onScroll={handleScroll}
          role="group"
          aria-label="Accessible sky directions"
        >
          <div
            className="flex items-stretch"
            style={{
              gap: `${CARD_GAP}px`,
              paddingInline: `${sidePadding}px`,
            }}
          >
            {sectors.map((sector, index) => {
              const isActive = index === activeIndex;

              return (
                <button
                  key={sector.id}
                  ref={element => {
                    buttonRefs.current[index] = element;
                  }}
                  type="button"
                  onClick={() => handleSectorPress(index, sector.label)}
                  onKeyDown={handleKeyDown}
                  data-sector-label={sector.label}
                  className={`relative shrink-0 snap-center overflow-hidden rounded-2xl border px-3 py-3 text-center transition-all duration-200 ${
                    isActive
                      ? 'scale-100 shadow-[0_0_0_1px_rgba(56,189,248,0.24)]'
                      : 'scale-[0.96] opacity-75 hover:opacity-100'
                  } ${getSectorToneClass(sector.minAltitude)}`}
                  style={{ width: `${CARD_WIDTH}px` }}
                  title={`${sector.label}: ${getSectorAltitudeLabel(sector.minAltitude)}`}
                  aria-label={`${sector.label}, ${getSectorAltitudeLabel(sector.minAltitude)}${
                    isActive
                      ? ', centered under the heading marker. Press to change blockage.'
                      : ', press to change blockage.'
                  }`}
                >
                  <div
                    className="pointer-events-none absolute inset-x-1.5 bottom-1.5 rounded-b-xl bg-night-950/55"
                    style={{ height: `${getBlockedHeightPercent(sector.minAltitude)}%` }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-1.5 rounded-full border-t border-white/20"
                    style={{ bottom: `${getBlockedHeightPercent(sector.minAltitude)}%` }}
                  />
                  <div className="relative z-10 font-semibold text-sm tracking-[0.14em]">
                    {sector.label}
                  </div>
                  <div className="relative z-10 mt-1 text-[11px]">
                    {getSectorAltitudeLabel(sector.minAltitude)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 text-gray-500 text-xs">
        Scroll around the compass to review each horizon sector. Tap any tile to move from Open to
        15°, 30°, 45°, then Blocked.
      </p>
    </div>
  );
}
