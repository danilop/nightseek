import { expect, it } from 'vitest';
import { estimateBortle, explainBortleEstimate } from './bortle-estimate';

it.each([
  [22, 1],
  [21.99, 2],
  [21.89, 3],
  [21.69, 4],
  [20.49, 5],
  [19.5, 6],
  [18.94, 7],
  [18.38, 8],
  [17.8, 9],
])('maps the documented reference sky %s to %s', (sky, expected) => {
  expect(estimateBortle(sky)).toBeCloseTo(expected, 12);
});
it('interpolates continuously, including the repaired dark endpoint', () => {
  expect(estimateBortle(21.995)).toBeCloseTo(1.5, 10);
  expect(estimateBortle(21.94)).toBeCloseTo(2.5, 10);
  expect(estimateBortle(18.09)).toBeCloseTo(8.5, 10);
  expect(estimateBortle(18.1)?.toFixed(1)).toBe('8.5');
  for (const sky of [21.99, 21.89, 21.69, 20.49, 19.5, 18.94, 18.38, 17.8]) {
    expect(
      Math.abs((estimateBortle(sky - 1e-8) ?? 0) - (estimateBortle(sky + 1e-8) ?? 0))
    ).toBeLessThan(0.00001);
  }
});
it('stays bounded and increases monotonically as skies brighten', () => {
  let previous = 1;
  for (let i = 0; i <= 800; i++) {
    const result = estimateBortle(23 - i / 100);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(previous);
    expect(result).toBeLessThanOrEqual(9);
    previous = result ?? 1;
  }
  expect(estimateBortle(0)).toBe(9);
  for (const invalid of [null, NaN, Infinity, -1]) expect(estimateBortle(invalid)).toBeNull();
});
it('keeps precision until display and explains the estimate honestly', () => {
  expect(estimateBortle(18.14)).not.toBe(estimateBortle(18.1));
  expect(explainBortleEstimate(18.1)).toContain('Estimated Bortle 8.5');
  expect(explainBortleEstimate(18.1)).toContain('does not mean accuracy to 0.1 class');
  expect(explainBortleEstimate(18.1)).toContain('18.10 mag/arcsec²');
  expect(explainBortleEstimate(NaN)).toBe('No sky-brightness estimate available.');
});
