/**
 * Brightness-derived Bortle estimate, version 1.
 * Convention: LightPollutionMap.app's published SQM interpolation, inspected 2026-09-06.
 * Source and alternatives: docs/bortle-estimation.md.
 * We add the natural-sky anchor (22, 1) to remove its jump at 21.99.
 * This is an interpretive index, not a measured whole-sky Bortle classification.
 */
const REFERENCE_POINTS = [
  [22, 1],
  [21.99, 2],
  [21.89, 3],
  [21.69, 4],
  [20.49, 5],
  [19.5, 6],
  [18.94, 7],
  [18.38, 8],
  [17.8, 9],
] as const;

/** Interpolate in magnitudes (log brightness), preserving the full input precision.
 * Clamp at the scale endpoints; round only when displaying the result.
 */
export function estimateBortle(magnitudes: number | null): number | null {
  if (magnitudes === null || !Number.isFinite(magnitudes) || magnitudes < 0) return null;
  if (magnitudes >= 22) return 1;
  if (magnitudes <= 17.8) return 9;
  for (let i = 1; i < REFERENCE_POINTS.length; i++) {
    const [darkerSky, lowerClass] = REFERENCE_POINTS[i - 1];
    const [brighterSky, upperClass] = REFERENCE_POINTS[i];
    if (magnitudes >= brighterSky) {
      const fraction = (darkerSky - magnitudes) / (darkerSky - brighterSky);
      return lowerClass + fraction * (upperClass - lowerClass);
    }
  }
  return null;
}

export function explainBortleEstimate(magnitudes: number): string {
  const value = estimateBortle(magnitudes);
  if (value === null) return 'No sky-brightness estimate available.';
  return `Bortle ${value.toFixed(1)}: 1 darkest → 9 brightest. NightSeek’s estimate from a published brightness mapping, not an observed or atlas-provided class. Decimals aid comparison, not accuracy to 0.1 class.\n\nSky: ${magnitudes.toFixed(2)} mag/arcsec² (magnitudes per square arcsecond). Higher is darker; 22 is near-pristine. Horizon glow, local lights, transparency and visible objects affect actual Bortle class.`;
}
