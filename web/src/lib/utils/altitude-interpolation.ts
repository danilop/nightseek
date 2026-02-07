/**
 * Binary-search + linear interpolation to get altitude at a given time.
 * Returns 0 if time is outside the sample range or samples are empty.
 */
export function getAltitudeAtTime(samples: [Date, number][], time: Date): number {
  if (samples.length === 0) return 0;
  if (samples.length === 1) return samples[0][1];

  const timeMs = time.getTime();
  const firstMs = samples[0][0].getTime();
  const lastMs = samples[samples.length - 1][0].getTime();

  // Outside range
  if (timeMs <= firstMs) return samples[0][1];
  if (timeMs >= lastMs) return samples[samples.length - 1][1];

  // Binary search for the bracketing pair
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (samples[mid][0].getTime() <= timeMs) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Linear interpolation between samples[lo] and samples[hi]
  const t0 = samples[lo][0].getTime();
  const t1 = samples[hi][0].getTime();
  const a0 = samples[lo][1];
  const a1 = samples[hi][1];

  const fraction = (timeMs - t0) / (t1 - t0);
  return a0 + (a1 - a0) * fraction;
}
