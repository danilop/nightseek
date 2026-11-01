import { describe, expect, it } from 'vitest';
import { findFirstMatchingDay } from './search-astronomy';

describe('object-search future visibility', () => {
  it('does not skip a short non-monotonic window between sparse probe dates', async () => {
    const start = new Date('2026-01-01T12:00:00.000Z');
    const target = new Date('2026-01-04T12:00:00.000Z');

    const result = await findFirstMatchingDay(start, 7, date =>
      date.getTime() === target.getTime() ? date : null
    );

    expect(result?.toISOString()).toBe('2026-01-04T12:00:00.000Z');
  });

  it('returns null when no day in the inclusive search range matches', async () => {
    const result = await findFirstMatchingDay(new Date('2026-01-01T12:00:00Z'), 2, () => null);
    expect(result).toBeNull();
  });
});

it('advances civil nights across DST, retaining noon at the observing site', async () => {
  const dates: string[] = [];
  await findFirstMatchingDay(
    new Date('2026-03-28T12:00:00Z'),
    2,
    date => {
      dates.push(date.toISOString());
      return null;
    },
    'Europe/London'
  );
  expect(dates).toEqual([
    '2026-03-28T12:00:00.000Z',
    '2026-03-29T11:00:00.000Z',
    '2026-03-30T11:00:00.000Z',
  ]);
});
