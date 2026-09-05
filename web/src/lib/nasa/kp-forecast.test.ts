import { describe, expect, it } from 'vitest';
import { kpOutlookForWindow, parseKpForecast } from './kp-forecast';

describe('NOAA Kp forecast', () => {
  it('accepts both published schemas and rejects malformed data', () => {
    const row = { time_tag: '2026-09-05 21:00:00', kp: '5.33', observed: 'predicted' };
    const expected = parseKpForecast([row]);
    expect(expected[0]?.start.toISOString()).toBe('2026-09-05T21:00:00.000Z');
    expect(parseKpForecast([['time_tag', 'kp', 'observed'], null, Object.values(row)])).toEqual(
      expected
    );
    expect(
      parseKpForecast([
        null,
        {},
        { ...row, kp: null },
        { ...row, kp: 10 },
        { ...row, time_tag: 'bad' },
      ])
    ).toEqual([]);
  });
  it('never turns past observations or uncovered nights into forecasts', () => {
    const periods = parseKpForecast([
      { time_tag: '2026-09-05T21:00:00Z', kp: 9, observed: 'observed' },
      { time_tag: '2026-09-06T00:00:00Z', kp: 4, observed: 'predicted' },
    ]);
    expect(
      kpOutlookForWindow(periods, new Date('2026-09-05T20:00Z'), new Date('2026-09-06T01:00Z'))
        ?.maxKp
    ).toBe(4);
    expect(
      kpOutlookForWindow(periods, new Date('2026-09-06T03:00Z'), new Date('2026-09-07T03:00Z'))
    ).toBeNull();
  });
});
