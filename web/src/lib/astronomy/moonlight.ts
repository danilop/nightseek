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
  const maxAltitude = altitudeSamples.reduce(
    (maximum, [, altitude]) => Math.max(maximum, altitude),
    -90
  );

  let visibleMs = 0;
  for (let index = 1; index < altitudeSamples.length; index++) {
    const [startTime, startAltitude] = altitudeSamples[index - 1];
    const [endTime, endAltitude] = altitudeSamples[index];
    const segmentMs = Math.max(0, endTime.getTime() - startTime.getTime());
    visibleMs += segmentMs * visibleSegmentFraction(startAltitude, endAltitude);
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
