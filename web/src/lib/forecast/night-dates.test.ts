import { describe, expect, it } from 'vitest';
import { SkyCalculator } from '../astronomy/calculator';
import { firstNightDate, nightDateAtOffset } from './night-dates';

describe('observing night calendar', () => {
  it.each([
    ['2026-03-28T12:00Z', '2026-03-29T11:00:00.000Z'],
    ['2026-10-24T11:00Z', '2026-10-25T12:00:00.000Z'],
  ])('preserves local noon across DST from %s', (start, expected) => {
    expect(nightDateAtOffset(new Date(start), 'Europe/London', 1).toISOString()).toBe(expected);
  });
  it('keeps the ongoing observing night after midnight', () => {
    const calculator = new SkyCalculator(51.5, 0, 0);
    expect(
      firstNightDate(new Date('2026-09-06T00:30Z'), 'Europe/London', calculator).toISOString()
    ).toBe('2026-09-05T11:00:00.000Z');
    expect(
      firstNightDate(new Date('2026-09-06T12:30Z'), 'Europe/London', calculator).toISOString()
    ).toBe('2026-09-06T11:00:00.000Z');
  });
});
