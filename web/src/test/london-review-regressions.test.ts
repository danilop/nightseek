import { describe, expect, it } from 'vitest';
import { SkyCalculator } from '@/lib/astronomy/calculator';
import { localGalileanEvents } from '@/lib/astronomy/galilean-moons';
import { parseSkybot } from '@/lib/catalogs/skybot';
import { localOvation, parseOvation, parseSolarWind } from '@/lib/nasa/aurora-now';
import { computeAuroraForecast } from '@/lib/nasa/donki';
import {
  parseFlareProbabilities,
  parseSolarFlux,
  parseSunspotReport,
  utcTime,
} from '@/lib/nasa/swpc';
import { calculateSatellitePasses } from '@/lib/satellites/passes';
import { parseOMM } from '@/lib/satellites/tle';
import { getMoonPhaseName } from '@/lib/utils/format';
import { ensembleWindow, parseEnsemble } from '@/lib/weather/ensemble';
import { parseMetNorway } from '@/lib/weather/met-norway';
import { calculateHeadlineNightQuality } from '@/lib/weather/night-quality';
import { forecastConfidence, weatherCoverage } from '@/lib/weather/observing-conditions';
import { parseNightWeather, type WeatherAPIResponse } from '@/lib/weather/open-meteo';
import { createMockNightInfo } from './factories';
import fixture from './fixtures/london-2026-10-31.json';

const london = { latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' };
const calculator = new SkyCalculator(london.latitude, london.longitude);
const night = calculator.getNightInfo(new Date('2026-10-31T12:00:00Z'));
function weather(rain = 0): WeatherAPIResponse {
  const times = Array.from(
    { length: 11 },
    (_, i) => new Date('2026-10-31T19:00Z').getTime() / 1000 + i * 3600
  );
  const values = (v: number) => times.map(() => v);
  return {
    timezone: 'Europe/London',
    hourly: {
      time: times,
      cloud_cover: values(0),
      precipitation: values(rain),
      precipitation_probability: values(rain ? 100 : 0),
      wind_speed_10m: values(5),
      wind_gusts_10m: values(8),
      visibility: values(10000),
      temperature_2m: values(10),
      dew_point_2m: values(0),
      relative_humidity_2m: values(50),
    },
  };
}
describe('London review regressions — captured 31 October 2026', () => {
  it('matches independent USNO rise/set values within one minute', () => {
    for (const [actual, reference] of [
      [night.sunset, '2026-10-31T16:35Z'],
      [night.sunrise, '2026-11-01T06:54Z'],
      [night.moonRise, '2026-10-31T21:01Z'],
      [night.moonSet, '2026-11-01T13:43Z'],
    ] as const) {
      expect(actual).not.toBeNull();
      expect(Math.abs((actual as Date).getTime() - new Date(reference).getTime())).toBeLessThan(
        60_000
      );
    }
    expect(getMoonPhaseName(night.moonPhase)).toBe('Waning Gibbous');
  });
  it('parses real NOAA flare fields without silently replacing them with zero', () => {
    const days = parseFlareProbabilities(fixture.flare);
    expect(days[0]).toEqual({
      dateRange: '2026-10-31',
      cClassProbability: 25,
      mClassProbability: 1,
      xClassProbability: 1,
    });
    expect(days[2].dateRange).toBe('2026-11-02');
    expect(parseFlareProbabilities([{}])).toEqual([]);
  });
  it('selects newest flux regardless of array order and deduplicates current regions', () => {
    expect(parseSolarFlux(fixture.flux)?.flux).toBe(92);
    expect(parseSolarFlux([...fixture.flux].reverse())?.flux).toBe(92);
    const spots = parseSunspotReport(fixture.sunspots);
    expect(spots).toHaveLength(2);
    expect(spots.every(s => s.observedAt?.startsWith('2026-10-31') && s.spotClass.length > 0)).toBe(
      true
    );
    expect(utcTime('2026-10-31 20:00:00')).toBe('2026-10-31T20:00:00.000Z');
  });
  it('keeps an expired empty DONKI feed unknown', () => {
    expect(
      computeAuroraForecast(
        { fetchedAt: '2026-09-29T00:00Z', geomagneticStorms: [], solarFlares: [] } as Parameters<
          typeof computeAuroraForecast
        >[0],
        night.date,
        51.5
      ).chance
    ).toBe('unknown');
  });
  it('rejects rainy headline windows even when the sky input is clear', () => {
    const parsed = requireWeather(weather(1));
    expect(parsed.bestTime).toBeNull();
    expect(parsed.clearWindows).toEqual([]);
    expect(calculateHeadlineNightQuality(parsed, night).rating.stars).toBeLessThanOrEqual(2);
  });
  it('retains a dry opportunity between showers', () => {
    const raw = weather(1);
    raw.hourly.precipitation = raw.hourly.time.map((_, i) => (i >= 3 && i <= 6 ? 0 : 1));
    raw.hourly.precipitation_probability = raw.hourly.precipitation.map(v => (v ? 100 : 0));
    const parsed = requireWeather(raw);
    if (!parsed.bestTime) throw new Error('Expected dry observing window');
    expect(parsed.bestTime.start.getTime()).toBeGreaterThanOrEqual(
      new Date('2026-10-31T22:00Z').getTime()
    );
    expect(parsed.bestTime.end.getTime()).toBeLessThanOrEqual(
      new Date('2026-11-01T01:00Z').getTime()
    );
  });
  it('does not turn missing aerosols or weather into complete high confidence', () => {
    const parsed = requireWeather(weather());
    expect(weatherCoverage(parsed, night)).toMatchObject({ weather: 11, expected: 11, aerosol: 0 });
    expect(forecastConfidence(parsed, night)).not.toBe('high');
    expect(calculateHeadlineNightQuality(parsed, night).rating.stars).toBeLessThan(5);
    expect(forecastConfidence(null, night)).toBe('low');
  });
  it('includes the London dawn ISS twilight pass with OMM and six-digit IDs', () => {
    const elements = parseOMM(fixture.omm);
    expect(elements).toHaveLength(1);
    const passes = calculateSatellitePasses(elements[0], london, [night]);
    const twilight = passes.find(p => p.riseTime.getTime() > night.astronomicalDawn.getTime());
    if (!twilight) throw new Error('Expected London twilight pass');
    expect(
      Math.abs(twilight.riseTime.getTime() - new Date('2026-11-01T05:30:38Z').getTime())
    ).toBeLessThan(35_000);
    expect(twilight.maxAltitude).toBeCloseTo(14.7, 0);
    expect(parseOMM([{ ...fixture.omm[0], NORAD_CAT_ID: 100001 }])[0].noradId).toBe(100001);
    expect(parseOMM([{ ...fixture.omm[0], EPOCH: 'bad' }])).toEqual([]);
  });
  it('marks below-horizon Jupiter phenomena as unobservable in London', () => {
    const result = localGalileanEvents(
      [
        { moon: 'Europa', type: 'transit_start', time: new Date('2026-11-02T19:44:00Z') },
        { moon: 'Io', type: 'transit_start', time: new Date('2026-11-04T18:43:00Z') },
      ],
      london.latitude,
      london.longitude
    );
    expect(result.every(e => !e.observable && e.altitude < -20)).toBe(true);
  });
  it('requires complete simultaneous ensemble windows, not unrelated clear hours', () => {
    const raw = {
      hourly: {
        time: [0, 3600, 7200],
        cloud_cover: [0, 0, 0],
        precipitation: [0, 0, 0],
        wind_gusts_10m: [5, 5, 5],
        cloud_cover_member01: [0, 100, 0],
        precipitation_member01: [0, 0, 0],
        wind_gusts_10m_member01: [5, 5, 5],
      },
    };
    const range = createMockNightInfo({
      observingWindowStart: new Date(0),
      observingWindowEnd: new Date(7_200_000),
    });
    expect(ensembleWindow(parseEnsemble(raw), range)).toMatchObject({ support: 1, members: 2 });
    raw.hourly.wind_gusts_10m_member01 = [];
    expect(ensembleWindow(parseEnsemble(raw), range)).toMatchObject({
      support: 1,
      members: 2,
      gustMembers: 1,
      gustsAssessed: false,
    });
  });
  it('parses the live SkyBoT schema and rejects an error payload', () => {
    expect(parseSkybot(fixture.skybot)).toHaveLength(2);
    expect(() => parseSkybot({ error: 'Unavailable' })).toThrow();
    expect(() => parseSkybot([{ error: 'Unavailable' }])).toThrow();
  });
  it('validates captured OVATION and MET Norway schemas', () => {
    expect(parseOvation(fixture.ovation).coordinates).toHaveLength(100);
    expect(() => parseOvation({ coordinates: [] })).toThrow();
    expect(parseMetNorway(fixture.met).hours).toHaveLength(2);
    expect(() => parseMetNorway({})).toThrow();
  });
  it('rejects stale/inactive solar wind and expired OVATION', () => {
    const now = new Date('2026-10-31T21:00Z').getTime();
    const sample = {
      active: true,
      overall_quality: 0,
      source: 'ACE',
      time_tag: '2026-10-31T20:59:00',
      bz_gsm: -4,
    };
    expect(parseSolarWind([sample], 'bz_gsm', now)?.value).toBe(-4);
    expect(parseSolarWind([{ ...sample, active: false }], 'bz_gsm', now)).toBeNull();
    expect(
      parseSolarWind([{ ...sample, time_tag: '2026-10-31T18:00Z' }], 'bz_gsm', now)
    ).toBeNull();
    expect(
      localOvation(
        {
          observedAt: '2026-10-31T18:00Z',
          forecastAt: '2026-10-31T19:00Z',
          fetchedAt: '2026-10-31T21:00Z',
          coordinates: [[0, 51, 90]],
        },
        51.5,
        -0.1,
        now
      )
    ).toBeNull();
  });
});

function requireWeather(raw: WeatherAPIResponse) {
  const result = parseNightWeather(raw, null, night);
  if (!result) throw new Error('Expected weather fixture');
  return result;
}
