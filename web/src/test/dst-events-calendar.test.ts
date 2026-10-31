import { formatInTimeZone } from 'date-fns-tz';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionCalendar } from '@/lib/planning/calendar';
import { planSessionTargets } from '@/lib/planning/session';
import { formatDurationMinutes, formatTimeRange, getNightLabel } from '@/lib/utils/format';
import { createDefaultHorizonProfile } from '@/lib/utils/horizon-profile';
import { createMockObjectVisibility, createMockScoredObject } from './factories';

const cases = [
  {
    name: 'London spring skipped hour',
    zone: 'Europe/London',
    start: '2026-03-29T00:30Z',
    end: '2026-03-29T01:30Z',
    minutes: 60,
    startClock: '00:30',
    endClock: '02:30',
    range: '12:30 AM (UTC+00:00) – 2:30 AM (UTC+01:00)',
  },
  {
    name: 'New York spring skipped hour',
    zone: 'America/New_York',
    start: '2026-03-08T06:30Z',
    end: '2026-03-08T07:30Z',
    minutes: 60,
    startClock: '01:30',
    endClock: '03:30',
    range: '1:30 AM (UTC-05:00) – 3:30 AM (UTC-04:00)',
  },
  {
    name: 'London autumn equal clocks',
    zone: 'Europe/London',
    start: '2026-10-25T00:30Z',
    end: '2026-10-25T01:30Z',
    minutes: 60,
    startClock: '01:30',
    endClock: '01:30',
    range: '1:30 AM (UTC+01:00) – 1:30 AM (UTC+00:00)',
  },
  {
    name: 'New York autumn equal clocks',
    zone: 'America/New_York',
    start: '2026-11-01T05:30Z',
    end: '2026-11-01T06:30Z',
    minutes: 60,
    startClock: '01:30',
    endClock: '01:30',
    range: '1:30 AM (UTC-04:00) – 1:30 AM (UTC-05:00)',
  },
  {
    name: 'London autumn reversed clocks',
    zone: 'Europe/London',
    start: '2026-10-25T00:45Z',
    end: '2026-10-25T01:15Z',
    minutes: 30,
    startClock: '01:45',
    endClock: '01:15',
    range: '1:45 AM (UTC+01:00) – 1:15 AM (UTC+00:00)',
  },
  {
    name: 'New York autumn reversed clocks',
    zone: 'America/New_York',
    start: '2026-11-01T05:45Z',
    end: '2026-11-01T06:15Z',
    minutes: 30,
    startClock: '01:45',
    endClock: '01:15',
    range: '1:45 AM (UTC-04:00) – 1:15 AM (UTC-05:00)',
  },
];

function calendarInstant(calendar: string, field: 'DTSTART' | 'DTEND') {
  const match = calendar.match(
    new RegExp(`^${field}:(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z\\r?$`, 'm')
  );
  if (!match) throw new Error(`Missing absolute UTC ${field}`);
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6])
    )
  );
}

describe.each(cases)('$name: events during the clock change', sample => {
  const start = new Date(sample.start);
  const end = new Date(sample.end);
  const middle = new Date((start.getTime() + end.getTime()) / 2);
  const object = createMockScoredObject({
    visibility: createMockObjectVisibility({
      altitudeSamples: [
        [start, 60],
        [middle, 60],
        [end, 60],
      ],
      azimuthSamples: [
        [start, 180],
        [middle, 180],
        [end, 180],
      ],
      imagingWindow: {
        start,
        end,
        quality: 'good',
        qualityScore: 70,
        factors: { altitude: 60, airmass: 1.2, moonInterference: 0, cloudCover: 0 },
      },
    }),
  });

  it('makes equal or reversed local endpoints unambiguous', () => {
    expect(formatInTimeZone(start, sample.zone, 'HH:mm')).toBe(sample.startClock);
    expect(formatInTimeZone(end, sample.zone, 'HH:mm')).toBe(sample.endClock);
    expect(formatTimeRange(start, end, sample.zone)).toBe(sample.range);
  });

  it('computes session availability and elapsed clipping from actual UTC duration', () => {
    const [plan] = planSessionTargets([object], createDefaultHorizonProfile(), null, start);
    expect(plan.window.durationMinutes).toBe(sample.minutes);
    expect(plan.access.accessibleMinutes).toBe(sample.minutes);
    expect(formatDurationMinutes(plan.window.durationMinutes)).toBe(
      sample.minutes === 60 ? '1h' : '30m'
    );
    const remaining = planSessionTargets([object], createDefaultHorizonProfile(), null, middle);
    if (sample.minutes === 60) {
      expect(remaining).toHaveLength(1);
      expect(remaining[0].window.start).toEqual(middle);
      expect(remaining[0].window.durationMinutes).toBe(30);
    } else {
      // A 15-minute remainder cannot satisfy the 30-minute photo-session minimum.
      expect(remaining).toEqual([]);
    }
    expect(planSessionTargets([object], createDefaultHorizonProfile(), null, end)).toEqual([]);
  });

  it('exports exact UTC instants with a positive duration despite clock reversal', () => {
    const calendar = createSessionCalendar(
      { name: 'M31', start, end, location: sample.zone, description: sample.range },
      start
    );
    const exportedStart = calendarInstant(calendar, 'DTSTART');
    const exportedEnd = calendarInstant(calendar, 'DTEND');
    expect(exportedStart).toEqual(start);
    expect(exportedEnd).toEqual(end);
    expect((exportedEnd.getTime() - exportedStart.getTime()) / 60_000).toBe(sample.minutes);
    expect(calendar).not.toContain('TZID=');
    expect(() =>
      createSessionCalendar({
        name: 'M31',
        start: end,
        end: start,
        location: sample.zone,
        description: '',
      })
    ).toThrow(RangeError);
  });
});

describe('the exact second clocks change', () => {
  it.each([
    ['Europe/London', '2026-03-29T01:00Z', '00:59:59 +00:00', '02:00:00 +01:00'],
    ['America/New_York', '2026-03-08T07:00Z', '01:59:59 -05:00', '03:00:00 -04:00'],
    ['Europe/London', '2026-10-25T01:00Z', '01:59:59 +01:00', '01:00:00 +00:00'],
    ['America/New_York', '2026-11-01T06:00Z', '01:59:59 -04:00', '01:00:00 -05:00'],
  ])('%s at %s advances one actual second', (zone, timestamp, previous, next) => {
    const instant = new Date(timestamp);
    const before = new Date(instant.getTime() - 1000);
    expect(formatInTimeZone(before, zone, 'HH:mm:ss xxx')).toBe(previous);
    expect(formatInTimeZone(instant, zone, 'HH:mm:ss xxx')).toBe(next);
    const calendar = createSessionCalendar(
      { name: 'Clock change', start: before, end: instant, location: zone, description: '' },
      before
    );
    expect(
      calendarInstant(calendar, 'DTEND').getTime() - calendarInstant(calendar, 'DTSTART').getTime()
    ).toBe(1000);
  });
});

describe('tomorrow after a 25-hour local day', () => {
  afterEach(() => vi.useRealTimers());
  it.each([
    ['Europe/London', '2026-10-24T23:30Z', '2026-10-26T12:00Z', 'Tomorrow (Mon 26)'],
    ['America/New_York', '2026-11-01T04:30Z', '2026-11-02T17:00Z', 'Tomorrow (Mon 2)'],
  ])('%s adds a location calendar day', (zone, now, tomorrow, label) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    expect(getNightLabel(new Date(tomorrow), false, zone)).toBe(label);
  });
});
