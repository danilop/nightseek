import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { describe, expect, it } from 'vitest';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { firstNightDate, nightDateAtOffset } from '@/lib/forecast/night-dates';
import { calculateHeadlineNightQuality } from '@/lib/weather/night-quality';
import { forecastConfidence } from '@/lib/weather/observing-conditions';
import { parseNightWeather, type WeatherAPIResponse } from '@/lib/weather/open-meteo';

const tromso = { latitude: 69.6492, longitude: 18.9553, timezone: 'Europe/Oslo' };
const quito = { latitude: -0.1807, longitude: -78.4678, timezone: 'America/Guayaquil' };
const polar = new SkyCalculator(tromso.latitude, tromso.longitude);
const equatorial = new SkyCalculator(quito.latitude, quito.longitude);
const atNoon = (day: string, timezone: string) => fromZonedTime(`${day}T12:00:00`, timezone);
const polarNight = (day: string) => polar.getNightInfo(atNoon(day, tromso.timezone));
const equatorialNight = (day: string) => equatorial.getNightInfo(atNoon(day, quito.timezone));
function withinMinute(actual: Date | null | undefined, utc: string) {
  expect(actual).toBeInstanceOf(Date);
  if (!actual) throw new Error('Expected a real rise/set event');
  expect(Math.abs(actual.getTime() - Date.parse(utc))).toBeLessThan(60_000);
}
function rawWeather(time: number[], timezone: string): WeatherAPIResponse {
  return { timezone, hourly: { time, cloud_cover: time.map(() => 0) } };
}

// Independent, minute-rounded US Naval Observatory references retrieved 2026-10-31.
// https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-31&coords=69.6492,18.9553&tz=0
// Eight UTC-date requests cover both sites on Jun21, Dec21, Oct31 and Nov1.
// The model assumes an unobstructed horizon: mountains and observer elevation are not tested.
describe('polar and equatorial independent astronomy checks', () => {
  it('matches Tromsø sunset, next sunrise and civil twilight across UTC dates', () => {
    const night = polarNight('2026-10-31');
    withinMinute(night.sunset, '2026-10-31T13:49:00Z');
    withinMinute(night.sunrise, '2026-11-01T07:10:00Z');
    withinMinute(night.civilDusk, '2026-10-31T15:00:00Z');
    withinMinute(night.civilDawn, '2026-11-01T05:58:00Z');
    expect(night.observingWindowMode).toBe('astronomical');
    expect(night.moonRise).toBeNull();
    expect(night.moonSet).toBeNull();
    expect(night.moonlight.visibleFraction).toBeCloseTo(1, 2);
  });

  it('matches Quito solar, lunar and twilight events across local midnight', () => {
    const night = equatorialNight('2026-10-31');
    withinMinute(night.sunset, '2026-10-31T23:01:00Z');
    withinMinute(night.sunrise, '2026-11-01T10:54:00Z');
    withinMinute(night.civilDusk, '2026-10-31T23:22:00Z');
    withinMinute(night.civilDawn, '2026-11-01T10:32:00Z');
    withinMinute(night.moonRise, '2026-11-01T04:45:00Z');
    withinMinute(night.moonSet, '2026-11-01T17:10:00Z');
  });

  it.each([
    ['2026-06-21', '23:19', '23:42'],
    ['2026-12-21', '23:16', '23:39'],
  ])('matches Quito sunset and twilight at the %s solstice', (day, sunset, dusk) => {
    const night = equatorialNight(day);
    withinMinute(night.sunset, `${day}T${sunset}:00Z`);
    withinMinute(night.civilDusk, `${day}T${dusk}:00Z`);
    expect(night.sunsetOccurs && night.sunriseOccurs).toBe(true);
    expect(night.observingWindowMode).toBe('astronomical');
    const hours =
      (night.observingWindowEnd.getTime() - night.observingWindowStart.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(9);
    expect(hours).toBeLessThan(10);
  });

  it('matches the polar-day reference without inventing a usable observing window', () => {
    const night = polarNight('2026-06-21');
    expect(night.sunsetOccurs || night.sunriseOccurs).toBe(false);
    expect(night.minimumSunAltitude).toBeGreaterThan(0);
    expect(night.observingWindowMode).toBe('none');
    expect(night.observingWindowEnd).toEqual(night.observingWindowStart);
    withinMinute(night.moonRise, '2026-06-21T10:18:00Z');
    withinMinute(night.moonSet, '2026-06-21T22:14:00Z');
    const target = polar.calculateVisibility(2, 60, night, 'Northern test target', 'dso');
    expect(target.isVisible).toBe(false);
    expect(target.altitudeSamples).toEqual([]);
    expect(calculateHeadlineNightQuality(null, night).score).toBe(0);
  });

  it('retains a long astronomical window during polar night despite no sunrise', () => {
    const night = polarNight('2026-12-21');
    expect(night.sunsetOccurs || night.sunriseOccurs).toBe(false);
    expect(night.observingWindowMode).toBe('astronomical');
    expect(night.minimumSunAltitude).toBeLessThan(-40);
    const hours =
      (night.observingWindowEnd.getTime() - night.observingWindowStart.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(13);
    expect(hours).toBeLessThan(14);
    withinMinute(night.civilDusk, '2026-12-21T12:53:00Z');
    // Morning twilight belongs to Dec22; the Dec21 USNO value is not reused.
    expect(night.moonRise).toBeNull();
    expect(night.moonSet).toBeNull();
    expect(night.moonlight.visibleFraction).toBeCloseTo(1, 2);
  });

  it.each([
    ['2026-04-01', 'nautical'],
    ['2026-04-15', 'civil'],
    ['2026-05-01', 'sunset'],
  ] as const)('uses %s twilight without labelling it astronomical darkness', (day, mode) => {
    const night = polarNight(day);
    expect(night.astronomicalNightMode).toBe('none');
    expect(night.observingWindowMode).toBe(mode);
    expect(night.observingWindowEnd.getTime()).toBeGreaterThan(
      night.observingWindowStart.getTime()
    );
    expect(night.minimumSunAltitude).toBeGreaterThan(-18);
    const target = polar.calculateVisibility(2, 60, night, 'Northern test target', 'dso');
    expect(target.isVisible).toBe(true);
    expect(target.altitudeSamples.length).toBeGreaterThan(1);
  });
});

describe('analyzer calendar anchoring at observing-site timezone', () => {
  it.each([
    ['Tromsø', tromso, polar, '2026-10-31'],
    ['Quito', quito, equatorial, '2026-10-31'],
    ['Tromsø polar winter', tromso, polar, '2026-12-21'],
  ] as const)(
    'keeps the ongoing previous evening in %s at 01:00',
    (_name, site, calculator, day) => {
      const now = fromZonedTime(`${day}T01:00:00`, site.timezone);
      const previous = nightDateAtOffset(now, site.timezone, -1);
      const previousNight = calculator.getNightInfo(previous);
      expect(now.getTime()).toBeGreaterThan(previousNight.observingWindowStart.getTime());
      expect(now.getTime()).toBeLessThan(previousNight.observingWindowEnd.getTime());
      expect(firstNightDate(now, site.timezone, calculator)).toEqual(previous);
    }
  );

  it.each([tromso, quito])('starts at today at local noon in $timezone', site => {
    const now = atNoon('2026-10-31', site.timezone);
    const calculator = new SkyCalculator(site.latitude, site.longitude);
    expect(firstNightDate(now, site.timezone, calculator)).toEqual(now);
  });

  it.each(['2026-03-28', '2026-10-24'])(
    'advances Tromsø calendar dates through DST from %s',
    day => {
      const date = atNoon(day, tromso.timezone);
      const next = nightDateAtOffset(date, tromso.timezone, 1);
      const expectedDay = day === '2026-03-28' ? '2026-03-29 12:00' : '2026-10-25 12:00';
      expect(formatInTimeZone(next, tromso.timezone, 'yyyy-MM-dd HH:mm')).toBe(expectedDay);
      expect((next.getTime() - date.getTime()) / 3_600_000).toBe(day === '2026-03-28' ? 23 : 25);
    }
  );
});

describe('latitude visibility and unavailable weather', () => {
  it('shows both celestial hemispheres at the equator and excludes far-southern targets in Tromsø', () => {
    const night = equatorialNight('2026-10-31');
    for (const declination of [-60, 60]) {
      // RA 2h transits near local midnight in late October at both sites.
      const target = equatorial.calculateVisibility(2, declination, night, 'Test target', 'dso');
      expect(target.isVisible).toBe(true);
      expect(target.maxAltitude).toBeGreaterThan(29);
      expect(target.maxAltitude).toBeLessThan(31);
    }
    const south = polar.calculateVisibility(
      2,
      -60,
      polarNight('2026-10-31'),
      'Southern test target',
      'dso'
    );
    expect(south.isVisible).toBe(false);
    expect(south.maxAltitude).toBeLessThan(-35);
  });

  it.each([
    ['Tromsø', tromso, polarNight('2026-10-31')],
    ['Quito', quito, equatorialNight('2026-10-31')],
  ] as const)('keeps absent, empty and null weather unknown for %s', (_name, site, night) => {
    expect(parseNightWeather(rawWeather([], site.timezone), null, night)).toBeNull();
    const raw = rawWeather(
      [Math.ceil(night.observingWindowStart.getTime() / 3_600_000) * 3600],
      site.timezone
    );
    raw.hourly.cloud_cover = [null];
    expect(parseNightWeather(raw, null, night)).toBeNull();
    expect(forecastConfidence(null, night)).toBe('low');
    expect(calculateHeadlineNightQuality(null, night).score).toBeLessThan(50);
    raw.hourly.cloud_cover = [0];
    const partial = parseNightWeather(raw, null, night);
    expect(partial).not.toBeNull();
    expect(forecastConfidence(partial, night)).toBe('low');
  });

  it('does not count polar-day noon as an observing-weather hour', () => {
    const night = polarNight('2026-06-21');
    const raw = rawWeather([night.observingWindowStart.getTime() / 1000], tromso.timezone);
    expect(parseNightWeather(raw, null, night)).toBeNull();
  });
});
