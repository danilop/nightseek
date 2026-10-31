import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { firstNightDate, nightDateAtOffset } from '@/lib/forecast/night-dates';
import { formatDateKey } from '@/lib/utils/format';
import { weatherCoverage } from '@/lib/weather/observing-conditions';
import { parseNightWeather, type WeatherAPIResponse } from '@/lib/weather/open-meteo';

const cities = [
  { name: 'Sydney', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
  { name: 'Auckland', latitude: -36.8485, longitude: 174.7633, timezone: 'Pacific/Auckland' },
  { name: 'Honolulu', latitude: 21.3069, longitude: -157.8583, timezone: 'Pacific/Honolulu' },
] as const;

function localNoon(date: string, timezone: string): Date {
  return fromZonedTime(`${date}T12:00:00`, timezone);
}

// Captured from the independent USNO API on 31 October 2026. Times are local,
// at sea level; sunrise/civil dawn belong to the FOLLOWING calendar day.
// https://aa.usno.navy.mil/api/rstt/oneday?date=2026-06-21&coords=-33.8688,151.2093&tz=10&dst=false
// Repeat for the coordinates below, both dates and their following days. Use
// explicit local UTC offsets, since USNO's dst flag follows United States rules.
const solarReferences = [
  { city: 0, date: '2026-06-21', sunset: '16:54', dusk: '17:22', sunrise: '07:00', dawn: '06:32' },
  { city: 0, date: '2026-12-21', sunset: '20:05', dusk: '20:35', sunrise: '05:41', dawn: '05:12' },
  { city: 1, date: '2026-06-21', sunset: '17:12', dusk: '17:41', sunrise: '07:34', dawn: '07:05' },
  { city: 1, date: '2026-12-21', sunset: '20:40', dusk: '21:10', sunrise: '05:58', dawn: '05:28' },
  { city: 2, date: '2026-06-21', sunset: '19:16', dusk: '19:41', sunrise: '05:51', dawn: '05:26' },
  { city: 2, date: '2026-12-21', sunset: '17:55', dusk: '18:19', sunrise: '07:05', dawn: '06:41' },
];

// Official 2026 transitions: https://www.nsw.gov.au/about-nsw/daylight-saving
// https://www.govt.nz/browse/recreation-and-the-environment/daylight-saving/
const transitions = [
  { city: 0, date: '2026-04-04', elapsed: 25, repeatedHour: true },
  { city: 0, date: '2026-10-03', elapsed: 23, repeatedHour: false },
  { city: 1, date: '2026-04-04', elapsed: 25, repeatedHour: true },
  { city: 1, date: '2026-09-26', elapsed: 23, repeatedHour: false },
];

describe('Southern and Pacific observing-night regression matrix', () => {
  it.each(solarReferences)('matches USNO solar events: city $city, $date', reference => {
    const city = cities[reference.city];
    const calculator = new SkyCalculator(city.latitude, city.longitude);
    const noon = localNoon(reference.date, city.timezone);
    const night = calculator.getNightInfo(noon);
    const nextDate = formatDateKey(nightDateAtOffset(noon, city.timezone, 1), city.timezone);
    for (const [actual, date, time] of [
      [night.sunset, reference.date, reference.sunset],
      [night.civilDusk, reference.date, reference.dusk],
      [night.sunrise, nextDate, reference.sunrise],
      [night.civilDawn, nextDate, reference.dawn],
    ] as const) {
      expect(actual).toBeInstanceOf(Date);
      const expected = fromZonedTime(`${date}T${time}:00`, city.timezone);
      expect(Math.abs((actual as Date).getTime() - expected.getTime())).toBeLessThan(60_000);
    }
  });

  describe.each(cities)('$name', city => {
    const calculator = new SkyCalculator(city.latitude, city.longitude);

    it.each(['2026-06-21', '2026-12-21', '2026-10-31'])(
      'anchors the full local night and the ongoing pre-dawn forecast on %s',
      date => {
        const noon = localNoon(date, city.timezone);
        const night = calculator.getNightInfo(firstNightDate(noon, city.timezone, calculator));
        const nextNoon = nightDateAtOffset(noon, city.timezone, 1);
        const nextDate = formatDateKey(nextNoon, city.timezone);
        expect(formatDateKey(night.date, city.timezone)).toBe(date);
        expect(formatDateKey(night.sunset, city.timezone)).toBe(date);
        expect(formatDateKey(night.sunrise, city.timezone)).toBe(nextDate);
        expect(night.observingWindowMode).toBe('astronomical');
        const events = [
          night.sunset,
          night.civilDusk,
          night.nauticalDusk,
          night.astronomicalDusk,
          night.darkestTime,
          night.astronomicalDawn,
          night.nauticalDawn,
          night.civilDawn,
          night.sunrise,
        ];
        expect(events.every(event => event instanceof Date)).toBe(true);
        const timestamps = events.map(event => (event as Date).getTime());
        expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
        expect(new Set(timestamps).size).toBe(events.length);
        const predawn = fromZonedTime(`${nextDate}T02:00:00`, city.timezone);
        expect(firstNightDate(predawn, city.timezone, calculator)).toEqual(noon);
        expect(
          firstNightDate(new Date(night.sunrise.getTime() + 60_000), city.timezone, calculator)
        ).toEqual(nextNoon);
      }
    );

    it('has the correct seasonal reversal across hemispheres', () => {
      const duration = (date: string) => {
        const night = calculator.getNightInfo(localNoon(date, city.timezone));
        return night.astronomicalDawn.getTime() - night.astronomicalDusk.getTime();
      };
      const juneLonger = duration('2026-06-21') > duration('2026-12-21');
      expect(juneLonger).toBe(city.latitude < 0);
    });

    it('uses the destination calendar when the same UTC instant spans two local dates', () => {
      const date = firstNightDate(new Date('2026-10-31T22:00:00Z'), city.timezone, calculator);
      expect(formatDateKey(date, city.timezone)).toBe(
        city.latitude < 0 ? '2026-11-01' : '2026-10-31'
      );
    });
  });

  it.each(['2026-04-04', '2026-09-26', '2026-10-03', '2026-10-31'])(
    'keeps Honolulu at 24 hours across other locations’ DST changes: %s',
    date => {
      const city = cities[2];
      const noon = localNoon(date, city.timezone);
      expect(nightDateAtOffset(noon, city.timezone, 1).getTime() - noon.getTime()).toBe(86_400_000);
    }
  );

  it.each(transitions)(
    'preserves local noon and physical weather hours through DST: city $city, $date',
    transition => {
      const city = cities[transition.city];
      const noon = localNoon(transition.date, city.timezone);
      const nextNoon = nightDateAtOffset(noon, city.timezone, 1);
      expect((nextNoon.getTime() - noon.getTime()) / 3_600_000).toBe(transition.elapsed);
      expect(formatInTimeZone(nextNoon, city.timezone, 'HH:mm')).toBe('12:00');
      const calculator = new SkyCalculator(city.latitude, city.longitude);
      const night = calculator.getNightInfo(noon);
      const firstHour = Math.ceil(night.observingWindowStart.getTime() / 3_600_000);
      const lastHour = Math.floor(night.observingWindowEnd.getTime() / 3_600_000);
      const times = Array.from(
        { length: lastHour - firstHour + 1 },
        (_, i) => (firstHour + i) * 3600
      );
      const values = (value: number) => times.map(() => value);
      const response: WeatherAPIResponse = {
        timezone: city.timezone,
        hourly: {
          time: times,
          cloud_cover: values(0),
          precipitation: values(0),
          wind_gusts_10m: values(8),
          visibility: values(20_000),
        },
      };
      const weather = parseNightWeather(
        response,
        {
          timezone: city.timezone,
          hourly: { time: [...times].reverse(), aerosol_optical_depth: times.map(() => 0.1) },
        },
        night
      );
      expect(weather).not.toBeNull();
      if (!weather) throw new Error('Missing weather for a complete observing night');
      expect([...weather.hourlyData.keys()]).toEqual(times.map(time => time * 1000));
      expect(weatherCoverage(weather, night)).toEqual({
        expected: times.length,
        weather: times.length,
        aerosol: times.length,
        precipitation: times.length,
        wind: times.length,
        visibility: times.length,
      });
      const localTimes = times.map(time =>
        formatInTimeZone(new Date(time * 1000), city.timezone, 'HH:mm')
      );
      expect(localTimes.filter(time => time === '02:00')).toHaveLength(
        transition.repeatedHour ? 2 : 0
      );
      for (const time of times) {
        expect(firstNightDate(new Date(time * 1000), city.timezone, calculator)).toEqual(noon);
      }
    }
  );
});
