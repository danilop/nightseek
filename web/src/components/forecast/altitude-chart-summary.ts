import type { NightAltitudeTrack } from '@/lib/astronomy/night-altitude-track';
import type { TwilightBoundaries } from '@/lib/astronomy/twilight';
import { getTwilightPhaseAtFraction } from '@/lib/astronomy/twilight';
import { getAltitudeAtTime, getAzimuthAtTime } from '@/lib/utils/altitude-interpolation';
import { azimuthToCardinal, formatDurationMinutes, formatTime } from '@/lib/utils/format';
import type { HorizonThresholdSegment, TargetAccessibility } from '@/lib/utils/horizon-profile';

export interface AltitudeReadoutArgs {
  fraction: number;
  track: NightAltitudeTrack;
  segments: HorizonThresholdSegment[];
  boundaries: TwilightBoundaries;
  minimumAltitude: number;
  timezone?: string;
}

function toSamplePairs(track: NightAltitudeTrack): {
  altitudes: [Date, number][];
  azimuths: [Date, number][];
} {
  return {
    altitudes: track.points.map(point => [new Date(point.timeMs), point.altitude]),
    azimuths: track.points.map(point => [new Date(point.timeMs), point.azimuth]),
  };
}

function findSegmentAt(
  segments: HorizonThresholdSegment[],
  timeMs: number
): HorizonThresholdSegment | undefined {
  return (
    segments.find(segment => timeMs >= segment.startMs && timeMs <= segment.endMs) ??
    (timeMs < (segments[0]?.startMs ?? Number.POSITIVE_INFINITY)
      ? segments[0]
      : segments[segments.length - 1])
  );
}

/**
 * One-line description of a moment on the chart, used both as the visible
 * readout and as the scrubber's `aria-valuetext`.
 */
export function describeAltitudeAtFraction({
  fraction,
  track,
  segments,
  boundaries,
  minimumAltitude,
  timezone,
}: AltitudeReadoutArgs): string {
  if (track.points.length === 0) return 'No altitude data for this night.';

  const timeMs = track.startMs + (track.endMs - track.startMs) * Math.max(0, Math.min(1, fraction));
  const time = new Date(timeMs);
  const { altitudes, azimuths } = toSamplePairs(track);
  const altitude = getAltitudeAtTime(altitudes, time);
  const azimuth = getAzimuthAtTime(azimuths, time);
  const segment = findSegmentAt(segments, timeMs);

  const parts = [
    formatTime(time, timezone),
    `${Math.round(altitude)}°`,
    azimuthToCardinal(azimuth),
  ];

  if (altitude <= 0) {
    parts.push('below the horizon');
  } else if (segment?.isBlocked) {
    parts.push(`blocked by the ${segment.sectorLabel} obstruction`);
  } else if (segment && altitude < segment.thresholdDegrees) {
    parts.push(
      segment.sectorThresholdDegrees > minimumAltitude
        ? `below the ${segment.sectorLabel} obstruction at ${segment.thresholdDegrees}°`
        : `below your ${segment.thresholdDegrees}° minimum`
    );
  } else if (segment) {
    parts.push(
      segment.thresholdDegrees > 0 ? `above your ${segment.thresholdDegrees}° limit` : 'clear'
    );
  }

  parts.push(getTwilightPhaseAtFraction(fraction, boundaries).phase.label);

  return parts.join(' · ');
}

export interface AltitudeSummaryArgs {
  objectName: string;
  track: NightAltitudeTrack;
  accessibility: TargetAccessibility;
  peakAltitude: number;
  peakTime: Date | null;
  peakAzimuth: number;
  timezone?: string;
}

/** Accessible-name summary for the chart as a whole. */
export function getAltitudeChartSummary({
  objectName,
  track,
  accessibility,
  peakAltitude,
  peakTime,
  peakAzimuth,
  timezone,
}: AltitudeSummaryArgs): string {
  if (track.points.length === 0) {
    return `No altitude data for ${objectName} on this night.`;
  }

  const sentences = [
    `Altitude of ${objectName} from ${formatTime(new Date(track.startMs), timezone)} to ${formatTime(
      new Date(track.endMs),
      timezone
    )}.`,
  ];

  if (peakAltitude <= 0) {
    sentences.push('It stays below the horizon all night.');
  } else if (peakTime) {
    sentences.push(
      `Peaks at ${Math.round(peakAltitude)}° at ${formatTime(peakTime, timezone)} in the ${azimuthToCardinal(
        peakAzimuth
      )}.`
    );
  } else {
    sentences.push(`Peaks at ${Math.round(peakAltitude)}°.`);
  }

  if (accessibility.windows.length === 0) {
    sentences.push('It never clears your horizon limits.');
  } else {
    const windows = accessibility.windows
      .map(window => `${formatTime(window.start, timezone)} to ${formatTime(window.end, timezone)}`)
      .join(', ');
    sentences.push(
      `Above your horizon limits for ${formatDurationMinutes(accessibility.accessibleMinutes)} across ${
        accessibility.windows.length === 1 ? '1 window' : `${accessibility.windows.length} windows`
      }: ${windows}.`
    );
  }

  return sentences.join(' ');
}
