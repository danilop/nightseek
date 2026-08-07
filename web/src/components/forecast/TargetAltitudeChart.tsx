import { TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCurrentTime } from '@/hooks/useCurrentTime';
import {
  type AltAzSource,
  buildNightAltitudeTrack,
  type NightAltitudeTrack,
} from '@/lib/astronomy/night-altitude-track';
import {
  getTwilightBands,
  getTwilightBoundaries,
  TWILIGHT_GUIDE_ORDER,
  TWILIGHT_PHASES,
  type TwilightBand,
} from '@/lib/astronomy/twilight';
import { formatTime } from '@/lib/utils/format';
import {
  type AltAzSample,
  getHorizonThresholdSegments,
  type HorizonThresholdSegment,
  type TargetAccessibility,
} from '@/lib/utils/horizon-profile';
import type { HorizonProfile, NightInfo, ObjectVisibility } from '@/types';
import { describeAltitudeAtFraction, getAltitudeChartSummary } from './altitude-chart-summary';

/*
 * Fixed user-space geometry. The chart lives in a 400px detail panel on desktop
 * and a full-width bottom sheet on mobile, so a 340-unit viewBox scaled with
 * `width="100%"` keeps the scale factor near 1 and the labels legible without
 * measuring the container.
 */
const VIEW_WIDTH = 340;
const VIEW_HEIGHT = 208;
const PLOT_LEFT = 26;
const PLOT_RIGHT = 330;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 176;
const PLOT_WIDTH = PLOT_RIGHT - PLOT_LEFT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;

const GRID_DEGREES = [0, 15, 30, 45, 60, 75, 90];
const LABELLED_DEGREES = new Set([0, 30, 60, 90]);
/** Cardinal labels are only drawn on runs wide enough to hold them. */
const MIN_LABEL_RUN_WIDTH = 30;
const MAX_CARDINAL_LABELS = 4;

const BAND_OPACITY: Record<string, number> = {
  civil: 0.3,
  nautical: 0.3,
  astronomical: 0.22,
  night: 0.16,
};

const CURVE_COLOR = '#38bdf8';
const THRESHOLD_COLOR = '#fbbf24';
const MINIMUM_COLOR = '#a5b4fc';
const BLOCKED_COLOR = '#f87171';
const WINDOW_COLOR = '#4ade80';
const GRID_COLOR = '#4338ca';
const MARKER_COLOR = '#f8fafc';
const PEAK_COLOR = '#e0e7ff';

interface TargetAltitudeChartProps {
  visibility: ObjectVisibility;
  nightInfo: NightInfo;
  horizonProfile: HorizonProfile;
  accessibility: TargetAccessibility;
  /** Ephemeris source used to extend the curve across the twilight wings. */
  calculator: AltAzSource | null;
  timezone?: string;
}

interface Scales {
  x: (timeMs: number) => number;
  y: (altitude: number) => number;
}

function clampAltitude(altitude: number): number {
  return Math.max(0, Math.min(90, altitude));
}

function createScales(track: NightAltitudeTrack): Scales {
  const span = track.endMs - track.startMs;
  return {
    x: (timeMs: number) =>
      PLOT_LEFT + (span > 0 ? (timeMs - track.startMs) / span : 0) * PLOT_WIDTH,
    y: (altitude: number) => PLOT_BOTTOM - (clampAltitude(altitude) / 90) * PLOT_HEIGHT,
  };
}

/** Curve split into sub-paths so it is not drawn flat along the 0° axis. */
function buildCurvePaths(track: NightAltitudeTrack, scales: Scales): string[] {
  const paths: string[] = [];
  let current: string[] = [];

  for (const point of track.points) {
    if (point.altitude <= 0) {
      if (current.length > 1) paths.push(current.join(' '));
      current = [];
      continue;
    }
    const command = current.length === 0 ? 'M' : 'L';
    current.push(
      `${command}${scales.x(point.timeMs).toFixed(2)},${scales.y(point.altitude).toFixed(2)}`
    );
  }

  if (current.length > 1) paths.push(current.join(' '));
  return paths;
}

/** Filled area under the curve, closed onto the 0° baseline. */
function buildAreaPaths(curvePaths: string[]): string[] {
  return curvePaths.map(path => {
    const commands = path.split(' ');
    const firstX = commands[0].slice(1).split(',')[0];
    const lastX = commands[commands.length - 1].slice(1).split(',')[0];
    return `${path} L${lastX},${PLOT_BOTTOM} L${firstX},${PLOT_BOTTOM} Z`;
  });
}

/**
 * The horizon requirement as a step function: horizontal runs at each sector's
 * threshold, joined by vertical jumps where the target crosses a boundary.
 */
function buildThresholdPath(segments: HorizonThresholdSegment[], scales: Scales): string {
  if (segments.length === 0) return '';

  const commands: string[] = [];
  let started = false;

  for (const segment of segments) {
    const y = scales.y(segment.thresholdDegrees).toFixed(2);
    commands.push(started ? `V${y}` : `M${scales.x(segment.startMs).toFixed(2)},${y}`);
    commands.push(`H${scales.x(segment.endMs).toFixed(2)}`);
    started = true;
  }

  return commands.join(' ');
}

interface CardinalLabel {
  segment: HorizonThresholdSegment;
  startX: number;
  endX: number;
}

function pickCardinalLabels(segments: HorizonThresholdSegment[], scales: Scales): CardinalLabel[] {
  return segments
    .map(segment => ({
      segment,
      startX: scales.x(segment.startMs),
      endX: scales.x(segment.endMs),
    }))
    .filter(entry => entry.endX - entry.startX >= MIN_LABEL_RUN_WIDTH)
    .sort((a, b) => b.endX - b.startX - (a.endX - a.startX))
    .slice(0, MAX_CARDINAL_LABELS);
}

function TwilightBands({ bands }: { bands: TwilightBand[] }) {
  return (
    <>
      {bands.map(band => (
        <rect
          key={`${band.phase}-${band.startFraction}`}
          data-twilight-phase={band.phase}
          x={PLOT_LEFT + band.startFraction * PLOT_WIDTH}
          y={PLOT_TOP}
          width={(band.endFraction - band.startFraction) * PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill={TWILIGHT_PHASES[band.phase].color}
          fillOpacity={BAND_OPACITY[band.phase]}
        />
      ))}
    </>
  );
}

function BlockedSectors({
  segments,
  scales,
}: {
  segments: HorizonThresholdSegment[];
  scales: Scales;
}) {
  return (
    <>
      {segments
        .filter(segment => segment.isBlocked)
        .map(segment => (
          <rect
            key={`blocked-${segment.startMs}`}
            data-testid="blocked-sector"
            x={scales.x(segment.startMs)}
            y={PLOT_TOP}
            width={scales.x(segment.endMs) - scales.x(segment.startMs)}
            height={PLOT_HEIGHT}
            fill={BLOCKED_COLOR}
            fillOpacity={0.18}
          />
        ))}
    </>
  );
}

function AccessibleWindows({
  windows,
  scales,
}: {
  windows: TargetAccessibility['windows'];
  scales: Scales;
}) {
  return (
    <>
      {windows.map(window => {
        const startX = Math.max(PLOT_LEFT, scales.x(window.start.getTime()));
        const endX = Math.min(PLOT_RIGHT, scales.x(window.end.getTime()));
        if (endX <= startX) return null;
        return (
          <rect
            key={`window-${window.start.toISOString()}`}
            data-testid="accessible-window"
            x={startX}
            y={PLOT_TOP}
            width={endX - startX}
            height={PLOT_HEIGHT}
            fill={WINDOW_COLOR}
            fillOpacity={0.1}
          />
        );
      })}
    </>
  );
}

function AltitudeGrid({ scales }: { scales: Scales }) {
  return (
    <>
      {GRID_DEGREES.map(degrees => (
        <g key={`grid-${degrees}`}>
          <line
            x1={PLOT_LEFT}
            x2={PLOT_RIGHT}
            y1={scales.y(degrees)}
            y2={scales.y(degrees)}
            stroke={GRID_COLOR}
            strokeOpacity={degrees === 0 ? 0.9 : 0.4}
            strokeWidth={0.5}
          />
          {LABELLED_DEGREES.has(degrees) && (
            <text
              x={PLOT_LEFT - 4}
              y={scales.y(degrees) + 3}
              textAnchor="end"
              className="fill-gray-500 text-[9px]"
            >
              {degrees}°
            </text>
          )}
        </g>
      ))}
    </>
  );
}

/**
 * Highest point of the drawn curve. Taken from the track rather than from
 * `visibility.maxAltitude`, which only covers the analysed observing window and
 * would put the marker somewhere other than the visible apex.
 */
function findTrackPeak(track: NightAltitudeTrack): AltAzSample | null {
  let peak: AltAzSample | null = null;

  for (const point of track.points) {
    if (peak === null || point.altitude > peak.altitude) peak = point;
  }

  if (peak === null || peak.altitude <= 0) return null;
  // A maximum sitting on either endpoint is a clipped curve, not a culmination.
  if (peak.timeMs === track.startMs || peak.timeMs === track.endMs) return null;
  return peak;
}

interface ChartModel {
  track: NightAltitudeTrack;
  scales: Scales;
  bands: TwilightBand[];
  segments: HorizonThresholdSegment[];
  curvePaths: string[];
  areaPaths: string[];
  thresholdPath: string;
  cardinalLabels: CardinalLabel[];
  neverRises: boolean;
  minimumAltitude: number;
  peakAltitude: number;
  peakX: number | null;
  nowX: number | null;
  scrubX: number | null;
}

/** Everything the SVG needs, derived once per render. */
function buildChartModel(args: {
  track: NightAltitudeTrack;
  bands: TwilightBand[];
  segments: HorizonThresholdSegment[];
  visibility: ObjectVisibility;
  minimumAltitude: number;
  nowMs: number;
  scrubFraction: number | null;
}): ChartModel {
  const { track, bands, segments, visibility, minimumAltitude, nowMs, scrubFraction } = args;
  const scales = createScales(track);
  const curvePaths = buildCurvePaths(track, scales);
  const neverRises = visibility.maxAltitude <= 0;
  const peak = neverRises ? null : findTrackPeak(track);
  const showNow = nowMs >= track.startMs && nowMs <= track.endMs;

  return {
    track,
    scales,
    bands,
    segments,
    curvePaths,
    areaPaths: neverRises ? [] : buildAreaPaths(curvePaths),
    thresholdPath: buildThresholdPath(segments, scales),
    cardinalLabels: pickCardinalLabels(segments, scales),
    neverRises,
    minimumAltitude,
    peakAltitude: peak?.altitude ?? 0,
    peakX: peak === null ? null : scales.x(peak.timeMs),
    nowX: showNow ? scales.x(nowMs) : null,
    scrubX: scrubFraction === null ? null : PLOT_LEFT + scrubFraction * PLOT_WIDTH,
  };
}

function ChartCanvas({
  model,
  windows,
  summary,
  timezone,
}: {
  model: ChartModel;
  windows: TargetAccessibility['windows'];
  summary: string;
  timezone?: string;
}) {
  const { scales, minimumAltitude } = model;
  const showMinimum = minimumAltitude > 0;
  const minimumY = scales.y(minimumAltitude);

  return (
    <svg
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      width="100%"
      role="img"
      aria-label={summary}
      className="block"
    >
      <title>{summary}</title>
      <defs>
        <clipPath id="target-altitude-clip">
          <rect x={PLOT_LEFT} y={PLOT_TOP} width={PLOT_WIDTH} height={PLOT_HEIGHT} />
        </clipPath>
        <linearGradient id="target-altitude-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CURVE_COLOR} stopOpacity="0.28" />
          <stop offset="100%" stopColor={CURVE_COLOR} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      <TwilightBands bands={model.bands} />
      <BlockedSectors segments={model.segments} scales={scales} />
      <AccessibleWindows windows={windows} scales={scales} />
      <AltitudeGrid scales={scales} />

      <g clipPath="url(#target-altitude-clip)">
        {model.areaPaths.map(path => (
          <path key={`area-${path.slice(0, 24)}`} d={path} fill="url(#target-altitude-fill)" />
        ))}
        {model.curvePaths.map(path => (
          <path
            key={`curve-${path.slice(0, 24)}`}
            data-testid="altitude-curve"
            d={path}
            fill="none"
            stroke={CURVE_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {showMinimum && (
          <line
            data-testid="whole-sky-minimum"
            x1={PLOT_LEFT}
            x2={PLOT_RIGHT}
            y1={minimumY}
            y2={minimumY}
            stroke={MINIMUM_COLOR}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}

        {model.thresholdPath && (
          <path
            data-testid="sector-threshold"
            d={model.thresholdPath}
            fill="none"
            stroke={THRESHOLD_COLOR}
            strokeWidth={1.5}
            strokeLinejoin="miter"
          />
        )}

        {model.peakX !== null && (
          <circle
            data-testid="peak-marker"
            cx={model.peakX}
            cy={scales.y(model.peakAltitude)}
            r={2.5}
            fill={PEAK_COLOR}
            stroke="#0f0d24"
            strokeWidth={0.75}
          />
        )}

        {model.nowX !== null && (
          <line
            data-testid="now-marker"
            x1={model.nowX}
            x2={model.nowX}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke={MARKER_COLOR}
            strokeOpacity={0.7}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        )}

        {model.scrubX !== null && (
          <line
            x1={model.scrubX}
            x2={model.scrubX}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke={MARKER_COLOR}
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        )}
      </g>

      {/* Sits below the dotted line: the obstruction step line is always at or
          above the whole-sky minimum, so this corner can never collide. */}
      {showMinimum && (
        <text
          x={PLOT_LEFT + 3}
          y={minimumY + 9}
          textAnchor="start"
          className="fill-indigo-300 text-[9px]"
        >
          {minimumAltitude}° min
        </text>
      )}

      {model.cardinalLabels.map(({ segment, startX, endX }) => (
        <text
          key={`cardinal-${segment.startMs}`}
          x={(startX + endX) / 2}
          y={scales.y(segment.thresholdDegrees) - 3}
          textAnchor="middle"
          className="fill-amber-300 text-[9px]"
        >
          {segment.sectorLabel}
        </text>
      ))}

      {model.peakX !== null && (
        <text
          x={model.peakX}
          y={scales.y(model.peakAltitude) - 6}
          textAnchor="middle"
          className="fill-gray-300 text-[9px]"
        >
          {Math.round(model.peakAltitude)}°
        </text>
      )}

      <text
        x={PLOT_LEFT}
        y={VIEW_HEIGHT - 16}
        textAnchor="start"
        className="fill-gray-500 text-[9px]"
      >
        {formatTime(new Date(model.track.startMs), timezone)}
      </text>
      <text
        x={PLOT_RIGHT}
        y={VIEW_HEIGHT - 16}
        textAnchor="end"
        className="fill-gray-500 text-[9px]"
      >
        {formatTime(new Date(model.track.endMs), timezone)}
      </text>
    </svg>
  );
}

function ChartLegend({ showMinimum }: { showMinimum: boolean }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
      {TWILIGHT_GUIDE_ORDER.map(id => (
        <span key={id} className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: TWILIGHT_PHASES[id].color }}
          />
          {TWILIGHT_PHASES[id].shortLabel}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="inline-block h-0.5 w-3" style={{ backgroundColor: THRESHOLD_COLOR }} />
        Obstructions
      </span>
      {showMinimum && (
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-0.5 w-3"
            style={{
              backgroundImage: `repeating-linear-gradient(to right, ${MINIMUM_COLOR} 0 2px, transparent 2px 4px)`,
            }}
          />
          Minimum
        </span>
      )}
    </div>
  );
}

export default function TargetAltitudeChart({
  visibility,
  nightInfo,
  horizonProfile,
  accessibility,
  calculator,
  timezone,
}: TargetAltitudeChartProps) {
  const now = useCurrentTime();
  const [scrubFraction, setScrubFraction] = useState<number | null>(null);

  const track = useMemo(
    () => buildNightAltitudeTrack(visibility, nightInfo, calculator),
    [visibility, nightInfo, calculator]
  );
  const boundaries = useMemo(() => getTwilightBoundaries(nightInfo), [nightInfo]);
  const bands = useMemo(() => getTwilightBands(boundaries), [boundaries]);
  const segments = useMemo(
    () => getHorizonThresholdSegments(track.points, horizonProfile),
    [track.points, horizonProfile]
  );

  const summary = useMemo(() => {
    const peak = findTrackPeak(track);
    return getAltitudeChartSummary({
      objectName: visibility.commonName || visibility.objectName,
      track,
      accessibility,
      // The summary describes the drawn curve, so its peak comes from the same
      // track the marker does — not from the window-limited analysis.
      peakAltitude: peak?.altitude ?? visibility.maxAltitude,
      peakTime: peak === null ? visibility.maxAltitudeTime : new Date(peak.timeMs),
      peakAzimuth: peak?.azimuth ?? visibility.azimuthAtPeak,
      timezone,
    });
  }, [visibility, track, accessibility, timezone]);

  const readout = useMemo(() => {
    if (scrubFraction === null) return null;
    return describeAltitudeAtFraction({
      fraction: scrubFraction,
      track,
      segments,
      boundaries,
      minimumAltitude: horizonProfile.minimumAltitude,
      timezone,
    });
  }, [scrubFraction, track, segments, boundaries, horizonProfile.minimumAltitude, timezone]);

  const model = useMemo(
    () =>
      buildChartModel({
        track,
        bands,
        segments,
        visibility,
        minimumAltitude: horizonProfile.minimumAltitude,
        nowMs: now.getTime(),
        scrubFraction,
      }),
    [track, bands, segments, visibility, horizonProfile.minimumAltitude, now, scrubFraction]
  );

  if (track.points.length < 2) {
    return (
      <div className="rounded-lg bg-night-800 p-3">
        <p className="text-gray-500 text-xs">
          No usable dark window tonight, so there is no altitude track to plot.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-lg bg-night-800 p-3">
      <h3 className="mb-2 flex items-center gap-2 text-gray-300 text-sm">
        <TrendingUp className="h-4 w-4 text-sky-400" />
        Altitude through the night
      </h3>

      <div className="relative">
        <ChartCanvas
          model={model}
          windows={accessibility.windows}
          summary={summary}
          timezone={timezone}
        />

        {/* Scrubbing, keyboard access and focus all come from one native range
            input — the same approach the Overview night timeline uses. */}
        <input
          type="range"
          min="0"
          max="1000"
          step="1"
          value={scrubFraction === null ? 0 : Math.round(scrubFraction * 1000)}
          onChange={event => setScrubFraction(Number(event.target.value) / 1000)}
          onPointerLeave={() => setScrubFraction(null)}
          aria-label="Scrub the altitude chart"
          aria-valuetext={readout ?? summary}
          className="absolute inset-0 h-full w-full cursor-crosshair appearance-none bg-transparent opacity-0"
        />
      </div>

      <p aria-live="polite" className="mt-2 min-h-4 text-gray-400 text-xs">
        {readout ??
          (model.neverRises
            ? 'Stays below the horizon all night.'
            : 'Drag across the chart to read altitude and direction at any moment.')}
      </p>

      <ChartLegend showMinimum={horizonProfile.minimumAltitude > 0} />
    </section>
  );
}
