import { getAltitudeAtTime, getAzimuthAtTime } from '@/lib/utils/altitude-interpolation';
import type { AltAzSample } from '@/lib/utils/horizon-profile';
import type { NightInfo, ObjectVisibility } from '@/types';

/**
 * The slice of SkyCalculator the track builder needs. Keeping it minimal lets
 * tests pass a stub instead of constructing a real ephemeris calculator.
 */
export interface AltAzSource {
  getAltAz(raHours: number, decDeg: number, time: Date): { altitude: number; azimuth: number };
}

export interface NightAltitudeTrack {
  /** Strictly ascending, deduplicated by timestamp. */
  points: AltAzSample[];
  startMs: number;
  endMs: number;
  /** True when samples outside the analysed observing window were computed. */
  extended: boolean;
}

/** Matches the analyser's own sampling cadence. */
const DEFAULT_STEP_MINUTES = 10;

type TrackVisibility = Pick<
  ObjectVisibility,
  'raHours' | 'decDegrees' | 'altitudeSamples' | 'azimuthSamples'
>;

/**
 * The analyser only samples targets between `observingWindowStart` and
 * `observingWindowEnd`, but the night chart spans sunset→sunrise so it lines up
 * with the Overview timeline. This extends the curve across the twilight wings
 * while reusing the analysed samples verbatim inside the window, so the drawn
 * curve and the accessible-window maths always agree where it matters.
 *
 * The wings are computed from the object's fixed J2000 position, so a fast
 * mover (the Moon, at roughly 0.5°/hour) can be off by about a degree at the
 * far edge of a two-hour wing — invisible at chart resolution.
 */
/** Time span the chart should cover, and the span the analyser actually sampled. */
function resolveDomain(
  sampleTimes: number[],
  nightInfo: NightInfo,
  canExtend: boolean
): { startMs: number; endMs: number; sampleStartMs: number | null; sampleEndMs: number | null } {
  const sampleStartMs = sampleTimes.length > 0 ? sampleTimes[0] : null;
  const sampleEndMs = sampleTimes.length > 0 ? sampleTimes[sampleTimes.length - 1] : null;

  if (!canExtend) {
    return {
      startMs: sampleStartMs ?? 0,
      endMs: sampleEndMs ?? 0,
      sampleStartMs,
      sampleEndMs,
    };
  }

  return {
    startMs: Math.min(
      nightInfo.sunset.getTime(),
      nightInfo.observingWindowStart.getTime(),
      sampleStartMs ?? Number.POSITIVE_INFINITY
    ),
    endMs: Math.max(
      nightInfo.sunrise.getTime(),
      nightInfo.observingWindowEnd.getTime(),
      sampleEndMs ?? Number.NEGATIVE_INFINITY
    ),
    sampleStartMs,
    sampleEndMs,
  };
}

export function buildNightAltitudeTrack(
  visibility: TrackVisibility,
  nightInfo: NightInfo,
  calculator: AltAzSource | null,
  options: { stepMinutes?: number } = {}
): NightAltitudeTrack {
  const stepMs = Math.max(1, options.stepMinutes ?? DEFAULT_STEP_MINUTES) * 60_000;
  const { altitudeSamples, azimuthSamples } = visibility;
  const canExtend = calculator !== null;

  const sampleTimes = altitudeSamples
    .map(([time]) => time.getTime())
    .filter(timeMs => Number.isFinite(timeMs))
    .sort((a, b) => a - b);

  const { startMs, endMs, sampleStartMs, sampleEndMs } = resolveDomain(
    sampleTimes,
    nightInfo,
    canExtend
  );

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { points: [], startMs: startMs || 0, endMs: endMs || 0, extended: false };
  }

  const isAnalysed = (timeMs: number) =>
    sampleStartMs !== null &&
    sampleEndMs !== null &&
    timeMs >= sampleStartMs &&
    timeMs <= sampleEndMs;

  const times = new Set<number>(sampleTimes.filter(timeMs => timeMs >= startMs && timeMs <= endMs));
  times.add(startMs);
  times.add(endMs);

  if (canExtend) {
    for (let timeMs = startMs; timeMs < endMs; timeMs += stepMs) {
      if (!isAnalysed(timeMs)) times.add(timeMs);
    }
  }

  let extended = false;
  const points = [...times]
    .sort((a, b) => a - b)
    .map(timeMs => {
      const time = new Date(timeMs);

      if (isAnalysed(timeMs)) {
        return {
          timeMs,
          altitude: getAltitudeAtTime(altitudeSamples, time),
          azimuth: getAzimuthAtTime(azimuthSamples, time),
        };
      }

      extended = true;
      const position = (calculator as AltAzSource).getAltAz(
        visibility.raHours,
        visibility.decDegrees,
        time
      );
      return { timeMs, altitude: position.altitude, azimuth: position.azimuth };
    });

  return { points, startMs, endMs, extended };
}
