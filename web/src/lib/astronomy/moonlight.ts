import type { MoonlightInfo, MoonlightLevel } from '@/types';

function visibleSegmentFraction(startAltitude: number, endAltitude: number): number {
  if (startAltitude > 0 && endAltitude > 0) return 1;
  if (startAltitude <= 0 && endAltitude <= 0) return 0;

  const crossing = Math.abs(startAltitude) / Math.abs(endAltitude - startAltitude);
  return startAltitude > 0 ? crossing : 1 - crossing;
}

export function getMoonlightLevel(exposurePercent: number, maxAltitude: number): MoonlightLevel {
  if (maxAltitude <= 0 || exposurePercent <= 0) return 'none';
  if (exposurePercent < 10) return 'minimal';
  if (exposurePercent < 30) return 'low';
  if (exposurePercent < 60) return 'moderate';
  return 'strong';
}

/**
 * Summarize lunar illumination that is actually present in an observing window.
 * Linear interpolation at horizon crossings avoids 10-minute sampling jumps.
 */
export function calculateMoonlightInfo(
  moonIllumination: number,
  altitudeSamples: [Date, number][],
  windowStart: Date,
  windowEnd: Date
): MoonlightInfo {
  const windowMs = Math.max(0, windowEnd.getTime() - windowStart.getTime());
  let maxAltitude = -90;

  let visibleMs = 0;
  for (let index = 1; index < altitudeSamples.length; index++) {
    const [startTime, startAltitude] = altitudeSamples[index - 1];
    const [endTime, endAltitude] = altitudeSamples[index];
    const fullSegmentMs = endTime.getTime() - startTime.getTime();
    const startMs = Math.max(startTime.getTime(), windowStart.getTime());
    const endMs = Math.min(endTime.getTime(), windowEnd.getTime());
    if (fullSegmentMs <= 0 || endMs <= startMs) continue;
    const altitudeAt = (timeMs: number) =>
      startAltitude +
      ((endAltitude - startAltitude) * (timeMs - startTime.getTime())) / fullSegmentMs;
    const clippedStart = altitudeAt(startMs);
    const clippedEnd = altitudeAt(endMs);
    maxAltitude = Math.max(maxAltitude, clippedStart, clippedEnd);
    visibleMs += (endMs - startMs) * visibleSegmentFraction(clippedStart, clippedEnd);
  }

  const visibleFraction = windowMs > 0 ? Math.min(1, visibleMs / windowMs) : 0;
  const exposurePercent = Math.max(0, Math.min(100, moonIllumination * visibleFraction));

  return {
    visibleHours: visibleMs / 3_600_000,
    visibleFraction,
    maxAltitude,
    exposurePercent,
    level: getMoonlightLevel(exposurePercent, maxAltitude),
  };
}
