import { describe, expect, it } from 'vitest';
import { hasMagnitude, isMagnitudeEstimate, matchesMagnitudeLimit } from './magnitude';

describe('shared magnitude policy', () => {
  it.each([null, undefined, Number.NaN, Infinity, -Infinity])(
    'excludes unknown %s only when a limit is active',
    value => {
      expect(hasMagnitude(value)).toBe(false);
      expect(matchesMagnitudeLimit(value, null)).toBe(true);
      expect(matchesMagnitudeLimit(value, 20)).toBe(false);
      expect(matchesMagnitudeLimit(value, 0)).toBe(false);
    }
  );
  it('includes zero, negative values and the exact boundary', () => {
    for (const value of [-12, 0, 6]) expect(matchesMagnitudeLimit(value, 6)).toBe(true);
    expect(matchesMagnitudeLimit(6.01, 6)).toBe(false);
    expect(matchesMagnitudeLimit(30, null)).toBe(true);
  });
  it('marks moving-object predictions consistently', () => {
    expect(isMagnitudeEstimate('comet')).toBe(true);
    expect(isMagnitudeEstimate('planet')).toBe(true);
    expect(isMagnitudeEstimate('dso')).toBe(false);
  });
});
