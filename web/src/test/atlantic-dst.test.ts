import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { firstNightDate, nightDateAtOffset } from '@/lib/forecast/night-dates';
import { formatDateKey } from '@/lib/utils/format';
import { forecastConfidence, weatherCoverage } from '@/lib/weather/observing-conditions';
import { parseNightWeather, type WeatherAPIResponse } from '@/lib/weather/open-meteo';

const cities = [
  {
    name: 'London',
    latitude: 51.5074,
    longitude: -0.1278,
    timezone: 'Europe/London',
    spring: '2026-03-28',
    autumn: '2026-10-24',
  },
  {
    name: 'New York',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    spring: '2026-03-07',
    autumn: '2026-10-31',
  },
];
const hour = 3_600_000;
function noon(date: string, timezone: string) {
  return fromZonedTime(`${date}T12:00:00`, timezone);
}
function nextDate(date: string) {
  return new Date(new Date(`${date}T12:00Z`).getTime() + 24 * hour).toISOString().slice(0, 10);
}
function makeWeather(anchor: Date, timezone: string): WeatherAPIResponse {
  const time = Array.from(
    { length: 49 },
    (_, i) => (anchor.getTime() - 12 * hour + i * hour) / 1000
  );
  const fill = (value: number) => time.map(() => value);
  return {
    timezone,
    hourly: {
      time,
      cloud_cover: time.map((_, i) => i % 40),
      precipitation: fill(0),
      precipitation_probability: fill(0),
      visibility: fill(10000),
      wind_speed_10m: fill(5),
      wind_gusts_10m: fill(8),
      temperature_2m: fill(10),
      dew_point_2m: fill(0),
      relative_humidity_2m: fill(50),
    },
  };
}

describe.each(cities)('$name: location calendar, season and DST', city => {
  const calculator = new SkyCalculator(city.latitude, city.longitude);
  const dates = [
    '2026-06-21',
    '2026-12-21',
    city.spring,
    nextDate(city.spring),
    city.autumn,
    nextDate(city.autumn),
    '2026-10-31',
  ];
  it.each(dates)('%s: anchors to local noon and keeps ordered solar/Moon events', date => {
    const anchor = noon(date, city.timezone);
    const night = calculator.getNightInfo(anchor);
    expect(firstNightDate(anchor, city.timezone, calculator)).toEqual(anchor);
    expect(formatDateKey(night.date, city.timezone)).toBe(date);
    expect(formatInTimeZone(night.date, city.timezone, 'HH:mm')).toBe('12:00');
    expect(night.sunsetOccurs && night.sunriseOccurs).toBe(true);
    expect(formatDateKey(night.sunset, city.timezone)).toBe(date);
    expect(formatDateKey(night.sunrise, city.timezone)).toBe(nextDate(date));
    expect(night.sunset.getTime()).toBeLessThan(night.observingWindowStart.getTime());
    expect(night.observingWindowStart.getTime()).toBeLessThan(night.observingWindowEnd.getTime());
    expect(night.observingWindowEnd.getTime()).toBeLessThan(night.sunrise.getTime());
    for (const event of [night.moonRise, night.moonSet]) {
      if (!event) continue;
      expect(event.getTime()).toBeGreaterThanOrEqual(night.sunset.getTime());
      expect(event.getTime()).toBeLessThanOrEqual(night.sunset.getTime() + 24 * hour);
    }
    expect(
      firstNightDate(new Date(night.sunrise.getTime() - 1000), city.timezone, calculator)
    ).toEqual(anchor);
    expect(
      formatDateKey(
        firstNightDate(new Date(night.sunrise.getTime() + 1000), city.timezone, calculator),
        city.timezone
      )
    ).toBe(nextDate(date));
  });
  it.each([
    [city.spring, 23],
    [city.autumn, 25],
  ] as const)('preserves local noon across %s (%i UTC hours)', (date, hours) => {
    const anchor = noon(date, city.timezone);
    const next = nightDateAtOffset(anchor, city.timezone, 1);
    expect((next.getTime() - anchor.getTime()) / hour).toBe(hours);
    expect(formatInTimeZone(next, city.timezone, 'HH:mm')).toBe('12:00');
    const keys = Array.from({ length: 7 }, (_, index) =>
      formatDateKey(nightDateAtOffset(anchor, city.timezone, index), city.timezone)
    );
    expect(new Set(keys).size).toBe(7);
    expect(keys.every((key, i) => i === 0 || key === nextDate(keys[i - 1]))).toBe(true);
  });
  it('has longer northern observing windows in winter, including London summer twilight fallback', () => {
    const summer = calculator.getNightInfo(noon('2026-06-21', city.timezone));
    const winter = calculator.getNightInfo(noon('2026-12-21', city.timezone));
    expect(
      winter.observingWindowEnd.getTime() - winter.observingWindowStart.getTime()
    ).toBeGreaterThan(summer.observingWindowEnd.getTime() - summer.observingWindowStart.getTime());
    expect(winter.observingWindowMode).toBe('astronomical');
    expect(summer.observingWindowMode).toBe(city.name === 'London' ? 'nautical' : 'astronomical');
  });
  it.each([city.spring, city.autumn])(
    '%s: joins hourly weather/AQ in UTC across clock changes',
    date => {
      const anchor = noon(date, city.timezone);
      const night = calculator.getNightInfo(anchor);
      const raw = makeWeather(anchor, city.timezone);
      const selected = (raw.hourly.time as number[]).filter(
        t =>
          t * 1000 >= Math.floor(night.observingWindowStart.getTime() / 3_600_000) * 3_600_000 &&
          t * 1000 <= Math.ceil(night.observingWindowEnd.getTime() / 3_600_000) * 3_600_000
      );
      // Deliberately reverse AQ order: the join must use timestamps, not array position.
      const airTimes = [...selected].reverse();
      const result = parseNightWeather(
        raw,
        {
          timezone: city.timezone,
          hourly: {
            time: airTimes,
            aerosol_optical_depth: airTimes.map(t => (t % 10000) / 100000),
            pm2_5: airTimes.map(() => 10),
            pm10: airTimes.map(() => 15),
            dust: airTimes.map(() => 0),
          },
        },
        night
      );
      if (!result) throw new Error('Expected complete weather fixture');
      expect([...result.hourlyData.keys()]).toEqual(selected.map(t => t * 1000));
      for (const [time, weather] of result.hourlyData)
        expect(weather.aod).toBe(((time / 1000) % 10000) / 100000);
      const coverage = weatherCoverage(result, night);
      const duration =
        (Number(night.observingWindowEnd) - Number(night.observingWindowStart)) / 3_600_000;
      expect(coverage.expected).toBeCloseTo(duration, 10);
      expect(coverage.weather).toBeCloseTo(duration, 10);
      expect(coverage.aerosol).toBeCloseTo(duration, 10);
      const weightedCloud =
        selected.slice(0, -1).reduce((total, t, i) => {
          const hours =
            Math.max(
              0,
              Math.min(selected[i + 1] * 1000, +night.observingWindowEnd) -
                Math.max(t * 1000, +night.observingWindowStart)
            ) / 3_600_000;
          return total + hours * Number(raw.hourly.cloud_cover[raw.hourly.time.indexOf(t)]);
        }, 0) / duration;
      expect(result.avgCloudCover).toBeCloseTo(weightedCloud, 10);
      const labels = selected.map(t =>
        formatInTimeZone(new Date(t * 1000), city.timezone, 'HH:mm')
      );
      if (date === city.autumn) expect(labels.filter(label => label === '01:00')).toHaveLength(2);
      else expect(labels).not.toContain(city.name === 'London' ? '01:00' : '02:00');
      const partial = parseNightWeather(raw, null, night);
      expect(forecastConfidence(partial, night)).not.toBe('high');
      expect(
        parseNightWeather(
          {
            timezone: city.timezone,
            hourly: { time: raw.hourly.time, cloud_cover: raw.hourly.time.map(() => null) },
          },
          null,
          night
        )
      ).toBeNull();
    }
  );
});

describe('Atlantic independent references and opposite DST policies', () => {
  it.each([
    ['2026-01-15T12:00Z', '+00:00', '-05:00'],
    ['2026-03-15T12:00Z', '+00:00', '-04:00'],
    ['2026-07-15T12:00Z', '+01:00', '-04:00'],
    ['2026-10-28T12:00Z', '+00:00', '-04:00'],
  ])('uses each location’s own DST policy at %s', (instant, londonOffset, newYorkOffset) => {
    expect(formatInTimeZone(new Date(instant), cities[0].timezone, 'xxx')).toBe(londonOffset);
    expect(formatInTimeZone(new Date(instant), cities[1].timezone, 'xxx')).toBe(newYorkOffset);
  });
  // Minute-rounded independent USNO API references fetched 31 October 2026.
  // https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-31&coords=40.7128,-74.006&tz=0
  // Sunrise and New York Moon events use the next UTC day's response (2026-11-01).
  it.each([
    [cities[0], '2026-10-31T16:35Z', '2026-11-01T06:54Z', '2026-10-31T21:01Z', '2026-11-01T13:43Z'],
    [cities[1], '2026-10-31T21:53Z', '2026-11-01T11:26Z', '2026-11-01T02:59Z', '2026-11-01T18:07Z'],
  ] as const)(
    '$0.name Sun/Moon agrees with USNO to one minute',
    (city, sunset, sunrise, moonrise, moonset) => {
      const night = new SkyCalculator(city.latitude, city.longitude).getNightInfo(
        noon('2026-10-31', city.timezone)
      );
      for (const [actual, reference] of [
        [night.sunset, sunset],
        [night.sunrise, sunrise],
        [night.moonRise, moonrise],
        [night.moonSet, moonset],
      ] as const) {
        if (!actual) throw new Error(`Missing rise/set event for ${city.name}`);
        expect(Math.abs(actual.getTime() - new Date(reference).getTime())).toBeLessThan(60_000);
      }
    }
  );
  it.each([
    [cities[0], '2026-03-29T00:30Z', '2026-03-28'],
    [cities[0], '2026-03-29T01:30Z', '2026-03-28'],
    [cities[0], '2026-10-25T00:30Z', '2026-10-24'],
    [cities[0], '2026-10-25T01:30Z', '2026-10-24'],
    [cities[1], '2026-03-08T06:30Z', '2026-03-07'],
    [cities[1], '2026-03-08T07:30Z', '2026-03-07'],
    [cities[1], '2026-11-01T05:30Z', '2026-10-31'],
    [cities[1], '2026-11-01T06:30Z', '2026-10-31'],
  ] as const)('$0.name keeps the observing night at %s', (city, time, date) => {
    const result = firstNightDate(
      new Date(time),
      city.timezone,
      new SkyCalculator(city.latitude, city.longitude)
    );
    expect(formatDateKey(result, city.timezone)).toBe(date);
  });
  it('uses different London and New York date keys for the same UTC instant', () => {
    const time = new Date('2026-11-01T02:30Z');
    expect(formatDateKey(time, 'Europe/London')).toBe('2026-11-01');
    expect(formatDateKey(time, 'America/New_York')).toBe('2026-10-31');
  });
});
